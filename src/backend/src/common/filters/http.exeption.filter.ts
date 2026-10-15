import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
// import { AppErrorDefinition } from "src/common/config/error.config";

@Injectable()
@Catch() // Universal catch-all exception filter
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  // logger è creato per debug funziona un po come console log
  // si vedono nel terminale i log lanciati da questa classe

  catch(exception: unknown, host: ArgumentsHost) {
    // gli diciamo cosa eseguire (HTTP in questo caso)
    const ctx = host.switchToHttp();
    // metto nella variabile per gestire la risposta http
    const response = ctx.getResponse<Response>();
    // salvo la richiesta http
    const request = ctx.getRequest<Request>();

    let status: number;
    // accetto array di stringhe perche i DTO mi ritornano vari messaggi
    let exceMsg: string | string[];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exeResponse = exception.getResponse();

      if (status >= 500) {
        // cosi non mandiamo al frontend gli errori interni del server
        this.logger.error(
          `Internal Error: ${exception.message}`,
          exception.stack,
        );
        exceMsg = 'Internal server error';
      } else {
        this.logger.warn(
          `Client Error [${status}]: ${exception.message} - ${request.method} ${request.url}`,
        );
        if (typeof exeResponse === 'string') {
          exceMsg = exeResponse;
        } else {
          // messo any perche l'oggetto puo essere anche un oggetto DTO (che mi
          // passano array di stringhe in message) non solo AppErrorDefinition
          // quindi mi serve che copra piu tipi
          const errorObj = exeResponse as any;
          exceMsg = errorObj?.message || 'Bad request';
        }
      }
    } else {
      // Unhandled generic errors (e.g. database disconnect, runtime errors)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const message =
        exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;

      this.logger.error(`Internal Error: ${message}`, stack);
      exceMsg = 'Internal server error';
    }

    // cosa metto nella risposta
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exceMsg,
    });
  }

  // HttpException è una classe che 3 parametri: response, status, options?.
  //  response puo essere per o una stringa o un oggetto
  //  status che è il codice dell'errore
  //  option puo essere per esempio la causa del problema dipende dal codice
  /*
   *  message   │ string  │ Proprietà ereditata da Error. È una descrizione
   *            │         │ testuale dell'errore usata nei log.
   *
   *  name      │ string  │ Il nome della classe (es. "HttpException" o
   *            │         │ "NotFoundException").
   *
   *  stack     │ string  │ Il classico stack trace di debug (le righe di
   *            │         │ codice dove è avvenuto l'errore).
   */
}
