import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import {
  AppErrorDefinition,
  createWebSocketException,
  errors,
} from 'src/common/config/error.config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import { resolveActiveJwtUser } from 'src/common/guards/auth.guard';
import { getBlockedUserIds } from './notification-emit';
import {
  USER_EVICT_EVENT,
  type UserEvictEventPayload,
} from './notification-events';

/*
 * Quando si usa WebSocket si aggancia allo stesso server e utilizza la stessa
 * porta (che puo essere anche cambiata per i socket su uno vuole) HTTP di
 * NestJS (porta 3000) ma intercetta le richieste di tipo WebSocket, ovvero in
 * questo caso le notifiche  degli utenti collegati su quella porta.
 * Cors va messo perche è un'altro tipo di conessione costante.
 * Il WebSocketGateway è un punto di ingresso per le connessioni. È tipo il
 * controller delle API, però gestisce connessioni in tempo reale quindi se un
 * utente si connette a quella porte lui gestisce.
 */
@WebSocketGateway({
  cors: { origin: 'https://localhost:8443', credentials: true },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly jwtService: JwtService,
    private prisma: PrismaService,
  ) {}
  @WebSocketServer() server!: Server;
  // il '!' dice a typescript che è stata inizializzata e mi toglie l'errore

  private findToken(cookie: string | undefined): string {
    if (!cookie) return '';
    const accessToken = cookie
      .split(';')
      .find((str) => str.trim().startsWith('accessToken='));
    if (!accessToken) return '';
    const eqIdx = accessToken.indexOf('=');
    if (eqIdx === -1) return '';
    const rawValue = accessToken.slice(eqIdx + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  private handleJwtVerification(jwt: string) {
    let payload: any;

    try {
      payload = this.jwtService.verify(jwt);
    } catch (error) {
      throw createWebSocketException(errors.socket.unauthorized);
    }
    return payload;
  }

  private async findFriend(id: number) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requester_id: id }, { addressee_id: id }],
      },
      select: { requester_id: true, addressee_id: true },
    });

    const blockedSet = await getBlockedUserIds(this.prisma, id);

    return friendships
      .map((f) => ({
        friend_id: f.requester_id === id ? f.addressee_id : f.requester_id,
      }))
      .filter((f) => !blockedSet.has(f.friend_id));
  }

  private async statusUser(idUser: number, online: boolean) {
    const numUserRoom = this.server?.sockets?.adapter?.rooms?.get(
      'room-' + idUser,
    );
    // adapter è solo il registro che ha tutte le informazioni del socket
    if (online === true) {
      if (!numUserRoom || numUserRoom.size > 1) return;
    }
    if (online === false) {
      if (numUserRoom && numUserRoom.size > 0) return;
    }
    const userFriends = await this.findFriend(idUser);

    for (const f of userFriends) {
      if (!this.server?.sockets?.adapter?.rooms?.has('room-' + f.friend_id))
        continue;
      this.server.to('room-' + f.friend_id).emit('userStatus', {
        userId: idUser,
        isOnline: online,
      });
    }
  }

  async handleConnection(client: Socket, ...args: any[]) {
    try {
      const cookie = client.handshake.headers.cookie;
      if (!cookie) throw createWebSocketException(errors.socket.unauthorized);
      const jwt: string = this.findToken(cookie);
      const payload = this.handleJwtVerification(jwt);
      if (!payload.sub || payload.type !== 'access')
        throw createWebSocketException(errors.socket.unauthorized);

      const activeUser = await resolveActiveJwtUser(this.prisma, payload);
      if (!activeUser) {
        throw createWebSocketException(errors.socket.unauthorized);
      }

      client.data.user = { ...payload, ...activeUser };
      client.join('room-' + payload.sub);
      // creo le stanze in maniere che piu utenti che entrano nello stesso
      // dispositivo ricevano le notifiche
      await this.statusUser(client.data.user.id, true);
    } catch (error: any) {
      let returnError: AppErrorDefinition;
      if (error instanceof WsException) {
        returnError = error.getError() as AppErrorDefinition;
      } else {
        returnError = errors.socket.internalError;
      }
      client.timeout(2000).emit('error', returnError, () => {
        client.disconnect(true);
      });
      return;
    }
    console.log('User Connected', client.id);
  }

  async handleDisconnect(client: Socket) {
    if (client.data.user?.id) {
      await this.statusUser(client.data.user.id, false);
    }
  }

  @SubscribeMessage('getOnlineFriends')
  async handleGetOnlineFriends(@ConnectedSocket() client: Socket) {
    const id = client.data.user?.id;
    if (!id) return { userIds: [] };
    const friends = await this.findFriend(id);
    const rooms = this.server.sockets.adapter.rooms;
    return {
      userIds: friends
        .map((f) => f.friend_id)
        .filter((friendId) => rooms.has('room-' + friendId)),
    };
  }

  // subscribeMessage aspetta un messaggio che contenga l'evento scritto in
  // subscribe message
  @OnEvent('newNotification')
  handleNotificationEvent(userNotification: {
    idUser: number;
    message?: string;
    target: { subject: string; idTarget: number; recipe_id?: number | null };
  }) {
    this.server
      ?.to('room-' + userNotification.idUser)
      ?.emit('newNotification', {
        //        message: userNotification.message,
        target: userNotification.target,
      });
  }

  @OnEvent(USER_EVICT_EVENT)
  handleUserEviction(payload: UserEvictEventPayload) {
    if (!payload?.userId || !this.server) return;
    this.server.in?.('room-' + payload.userId)?.disconnectSockets(true);
  }
}

// @SubscribeMessage è tipo socket.on() di javascript
// socket.emit()
