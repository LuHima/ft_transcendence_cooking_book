import { UseFilters } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { WsException } from '@nestjs/websockets';
import { create } from 'domain';
import { Socket, Server } from 'socket.io';
import {
  AppErrorDefinition,
  createWebSocketException,
  errors,
} from 'src/common/config/error.config';
import { ActiveUserData } from 'src/common/decorators/current-user.decorator';
import { WebSocketExceptionFilter } from 'src/common/filters/webSocket.exception.filter';

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
  constructor(private readonly jwtService: JwtService) {}
  @WebSocketServer() server!: Server;
  // il '!' dice a typescript che è stata inizializzata e mi toglie l'errore

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

  private verify(cookie: string) {
    return this.handleJwtVerification(this.findToken(cookie));
  }
  
  handleConnection(client: Socket, ...args: any[]) {
    try {
      const cookie = client.handshake.headers.cookie;
      if (!cookie) throw createWebSocketException(errors.socket.unauthorized);
      const jwt: string = this.findToken(cookie);
      const payload = this.handleJwtVerification(jwt);
      client.data.user = payload;
      client.join('room-' + payload.id); // creo le stanze in maniere che piu utenti che entrano nello stesso dispositivo ricevano le notifiche
    } catch (error: any) {
      const returnError = error.getError() as AppErrorDefinition;
      client.timeout(2000).emit('error', returnError, () => {
        client.disconnect(true);
      });
      return;
    }
    console.log('User Connected', client.id);
  }

  handleDisconnect(client: Socket) {
    console.log('User Disconnected', client.id);
    // client.disconnect();
  }

  async notification(userId: string, notification: string) {
    
  }

  @SubscribeMessage('Friend request') // nome dell'evento un po come il path delle API
  friendRequests(@MessageBody() message: any) {
    console.log('hello');
  }

  @SubscribeMessage('comment on your the recipe')
  commentOnTheRecipe(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: any,
  ) {
    console.log(message);
    client.emit('Ehi', 'Ciaoooo');
  }

  @SubscribeMessage('Response on your comment')
  responseComment(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: any,
  ) {
    console.log(message);
    client.emit('Ehi', 'Ciaoooo');
  }

  @SubscribeMessage('Friend public a recipe')
  postingRecipe(
    @ConnectedSocket() client: Socket,
    @MessageBody() message: any,
  ) {
    console.log(message);
    this.server.emit('All_User', 'broadcast');
  }
}

// @SubscribeMessage è tipo socket.on() di javascript

//socket.emit()
