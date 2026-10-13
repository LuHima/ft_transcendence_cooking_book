import {
  ArgumentsHost,
  Catch,
  Logger,
  WsExceptionFilter,
} from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AppErrorDefinition } from '../config/error.config';

@Catch(WsException)
export class WebSocketExceptionFilter implements WsExceptionFilter {
  private readonly logger = new Logger(WsException.name);

  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();

    const errorDef = exception.getError() as AppErrorDefinition;
    // devo farlo perforza altrimenti typescript non sa che tipo di informazioni ha all'interno
    // quindi da errore dice non ha questi valori

    this.logger.warn(errorDef.statusCode + errorDef.message);

    let returnError = {
      statusCode: errorDef.statusCode,
      timestamp: new Date().toISOString(),
      message: errorDef.message,
      error: errorDef.error,
    };
    if (errorDef.statusCode === 401) {
      // questa linea si assicura che il messaggio arrivi per forza all'utente e che non si discontetta prima
      // che arrivi il messaggio, se non risponde in 2 secondi però viene disconnesso lo stesso
      client.timeout(2000).emit('error', returnError, () => {
        client.disconnect(true);
      });
    } else client.emit('error', returnError);
  }
}
