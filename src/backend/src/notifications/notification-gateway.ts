import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

import { Socket, Server } from 'socket.io';
import {
  AppErrorDefinition,
  createWebSocketException,
  errors,
} from 'src/common/config/error.config';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from 'prisma/prisma.service';

// Quando si usa WebSocket si aggancia allo stesso server e utilizza la stessa porta
// (che puo essere anche cambiata per i socket su uno vuole) HTTP di NestJS (porta 3000)
// ma intercetta le richieste di tipo WebSocket
// il WebSocketGateway è un punto di ingresso per le connessioni
// è tipo il controlle delle API, però gestisce connessioni in tempo reale quindi se un utente si connette a quella porte lui gestisce
// le notifiche (in questo caso) degli utenti collegati su quella porta
// cors va messo perche è un'altro tipo di conessione  costante
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

  // private isOnlyne <int, boolean>;
  private findToken(cookie: string | undefined): string {
    if (!cookie) return '';
    const accessToken = cookie
      .split(';')
      .find((str) => str.trim().startsWith('accessToken='));
    if (!accessToken) return '';
    const jwt = accessToken.split('=');
    if (!jwt) return '';
    return jwt[1];
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

  /*   private verify(cookie: string) {
    return this.handleJwtVerification(this.findToken(cookie));
  } */
  private async findFriend(id: number) {
    return this.prisma.follow.findMany({
      where: { following_id: id },
      select: { follower_id: true },
    }); // momentaneo poi da aggiustare
  }
  private async statusUser(idUser: number, online: boolean) {
    const numUserRoom = this.server.sockets.adapter.rooms.get('room-' + idUser);
    // adapter è solo il registro che ha tutte le informazioni del socket
    if (online === true) {
      if (!numUserRoom || numUserRoom.size > 1) return;
    }
    if (online === false) {
      if (numUserRoom && numUserRoom.size > 0) return;
    }
    const userFriends = await this.findFriend(idUser);

    for (const f of userFriends) {
      if (!this.server.sockets.adapter.rooms.has('room-' + f.follower_id))
        continue;
      this.server.to('room-' + f.follower_id).emit('userStatus', {
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
      client.data.user = payload;
      client.join('room-' + payload.id); // creo le stanze in maniere che piu utenti che entrano nello stesso dispositivo ricevano le notifiche
      const notification = await this.prisma.notification.findMany({
        where: { user_id: payload.id, is_read: false },
      });
      client.emit('unreadNotifications', {
        notification,
      });
      await this.statusUser(client.data.user.id, true);
    } catch (error: any) {
      const returnError = error.getError() as AppErrorDefinition;
      client.timeout(2000).emit('error', returnError, () => {
        client.disconnect(true);
      });
      return;
    }
    console.log('User Connected', client.id);
  }

  async handleDisconnect(client: Socket) {
    //console.log('User Disconnected', client.id);
    if (client.data.user?.id) {
      await this.statusUser(client.data.user.id, false);
    }
  }

  //  subscribeMessage aspetta un messaggio che contenga l'evento scritto in subscribe message
  @OnEvent('newNotification')
  handleNotificationEvent(userNotification: {
    idUser: number;
    message: string;
  }) {
    this.server
      .to('room-' + userNotification.idUser)
      .emit('newNotification', userNotification.message);
  }
}

// @SubscribeMessage è tipo socket.on() di javascript

//socket.emit()
