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

import { Socket, Server } from 'socket.io';

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

  findToken(cookie: string | undefined) {
    if (!cookie) return '';
    const accessToken = cookie
      .split(';')
      .find((str) => str.trim().startsWith('accessToken='));
    if (!accessToken) return '';
    const jwt = accessToken.split('=');
    return accessToken;
  }
  handleConnection(client: Socket, ...args: any[]) {
    const cookie = client.handshake.headers.cookie;
    if (!cookie) {
      client.disconnect();
      console.log('no cookie found', cookie);
    }
    const jwt: string = this.findToken(cookie);
    if (jwt.length === 0) {
      console.log('access token not found');
      return;
    }
    if (this.jwtService.verify(jwt)) {
      console.log('access Denied, invalid token');
      return;
    }
    console.log('User Connected', client.id);

    client.disconnect(); // !TODO : pusho per lavorare sul fisso
  }
  handleDisconnect(client: Socket) {
    console.log('User Disconnected', client.id);
  }

  async notification(userId: string, notification: string) {}
  @WebSocketServer() server!: Server;
  // il '!' dice a typescript che è stata inizializzata e mi toglie l'errore

  @SubscribeMessage('Hellooooo') // nome dell'evento un po come il path delle API
  handleNewMessagge(@MessageBody() message: any) {
    console.log('hello');
  }

  @SubscribeMessage('Ehi') // nome dell'evento un po come il path delle API
  handleNewMsg(@ConnectedSocket() client: Socket, @MessageBody() message: any) {
    console.log(message);
    client.emit('Ehi', 'Ciaoooo');
  }

  @SubscribeMessage('All_User') // nome dell'evento un po come il path delle API
  BroadCast(@ConnectedSocket() client: Socket, @MessageBody() message: any) {
    console.log(message);
    this.server.emit('All_User', 'broadcast');
  }
}

// @SubscribeMessage è tipo socket.on() di javascript

//socket.emit()
