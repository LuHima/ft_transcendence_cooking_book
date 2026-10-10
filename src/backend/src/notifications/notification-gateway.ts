import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';

@WebSocketGateway() // è tipo il controlle delle API, però gestisce connessioni in tempo reale quindi se un utente si connette a quella porte lui gestisce
// le notifiche (in questo caso) degli utenti collegati su quella porta
export class NotificationGateway {
  @SubscribeMessage('Hellooooo')
  handleNewMessagge(@MessageBody() message: any) {
    console.log('hello');
  }
}
