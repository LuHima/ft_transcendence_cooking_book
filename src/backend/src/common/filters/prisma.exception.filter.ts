import { Prisma } from '@prisma/client';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http.exeption.filter';
import { createHttpException, errors } from '../config/error.config';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);
  // Il logger è creato per debug. Funziona un po' come console log: i log
  // lanciati da questa classe si vedono nel terminale.
  private readonly httpFilter = new HttpExceptionFilter();

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    this.logger.error({
      code: exception.code,
      meta: exception.meta,
      message: exception.message,
      clientVersion: exception.clientVersion,
    });

    let customMessage: string;

    // Creo l'errore da passare a HttpExeptionFilter
    let convertionToHttpError: HttpException;
    if (exception.code === 'P2002') {
      const target = exception.meta?.target;
      // Unisco l'array in una sola stringa oppure se è una stringa e basta ci
      // metto target altrimenti di default ci va field. Lo faccio perche target
      // può essere 1 o più elementi
      const field = Array.isArray(target)
        ? target.join(', ')
        : typeof target === 'string'
          ? target
          : 'field';
      customMessage = `The ${field} is already in use`;
      convertionToHttpError = createHttpException(
        errors.database.uniqueConstraint,
        customMessage,
      );
    } else if (exception.code === 'P2025') {
      const field = exception.meta?.modelName || 'Record';
      customMessage = `The ${field} was not found`;
      convertionToHttpError = createHttpException(
        errors.database.recordNotFound,
        customMessage,
      );
    } else if (exception.code === 'P2003') {
      let field: string | undefined;
      const adapterErrorCause = (exception.meta?.driverAdapterError as any)
        ?.cause;
      const rawField =
        typeof exception.meta?.field_name === 'string'
          ? exception.meta.field_name
          : typeof adapterErrorCause?.constraint?.index === 'string'
            ? adapterErrorCause.constraint.index
            : typeof adapterErrorCause?.originalMessage === 'string'
              ? adapterErrorCause.originalMessage
              : undefined;

      if (rawField) {
        const fkeyMatch = rawField.match(/([a-zA-Z0-9_]+)_fkey/);
        if (fkeyMatch) {
          const parts = fkeyMatch[1].split('_');
          if (parts.length >= 2 && parts[parts.length - 1] === 'id') {
            field = `${parts[parts.length - 2]}_id`;
          } else {
            field = parts[parts.length - 1];
          }
        } else {
          field = rawField;
        }
      }

      customMessage = field
        ? `The ${field} key is not valid`
        : 'Related record was not found (foreign key constraint failed)';
      convertionToHttpError = createHttpException(
        errors.database.foreignKeyFailed,
        customMessage,
      );
    } else {
      convertionToHttpError = createHttpException(
        errors.database.generalPrismaError,
      );
    }
    this.httpFilter.catch(convertionToHttpError, host);
  }
}

/* 
### 1. Proprietà specifiche di Prisma

 Proprietà       │ Tipo               │ Descrizione         │ Esempio
─────────────────┼────────────────────┼─────────────────────┼───────────────────
 code            │ string             │ Il codice           │ 'P2002', 'P2025',
                 │                    │ dell'errore Prisma  │ 'P2003'
                 │                    │ (inizia sempre per  │
                 │                    │ P seguito da 4      │
                 │                    │ cifre). È quello    │
                 │                    │ che usi nei tuoi    │
                 │                    │ if/else.            │
─────────────────┼────────────────────┼─────────────────────┼───────────────────
 meta            │ Record<string,     │ La proprietà più    │ { target:
                 │ unknown> |         │ utile: un           │   ['email'],
                 │ undefined          │ dizionario con i    │ modelName:
                 │                    │ dettagli variabili  │   'User' }
                 │                    │ dell'errore         │
                 │                    │ dipendenti dal      │
                 │                    │ codice.             │
─────────────────┼────────────────────┼─────────────────────┼───────────────────
 clientVersion   │ string             │ La versione di      │ '5.19.0'
                 │                    │ Prisma Client       │
                 │                    │ attualmente in      │
                 │                    │ esecuzione. Utile   │
                 │                    │ nei log di sistema. │
─────────────────┼────────────────────┼─────────────────────┼───────────────────
 batchRequestIdx │ number | undefined │ Se l'errore è       │ 0
                 │                    │ avvenuto dentro una │
                 │                    │ transazione batch   │
                 │                    │ ($transaction([...] │
                 │                    │ )), indica l'indice │
                 │                    │ dell'operazione     │
                 │                    │ fallita (es. 0, 1). │


### 2. Proprietà ereditate da Error (JavaScript standard)

 Proprietà │ Tipo               │ Descrizione
───────────┼────────────────────┼───────────────────────────────────────────────
  message  │ string             │ Messaggio descrittivo generato da Prisma con
           │                    │ dettagli tecnici (spesso include snippet e
           │                    │ riferimenti interni).
───────────┼────────────────────┼───────────────────────────────────────────────
  name     │ string             │ Vale sempre 'PrismaClientKnownRequestError'.
  stack    │ string | undefined │ Lo stack trace con i file e le righe di
           │                    │ codice per il debug.

*/
