import { Prisma } from '@prisma/client';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, Logger } from "@nestjs/common";
import { HttpExceptionFilter } from './http.exeption.filter';
import { createHttpException, errors} from '../config/error.config';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter
{
	private readonly logger = new Logger(PrismaExceptionFilter.name);
	// logger è creato per debug funziona un po come console log
	// si vedono nel terminale i log lanciati da questa classe
	private readonly httpFilter = new HttpExceptionFilter();

	catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) 
	{
		this.logger.error({
			code: exception.code,
			meta: exception.meta,
			message: exception.message,
			clientVersion: exception.clientVersion,
		});

		let customMessage: string;

		let convertionToHttpError: HttpException; // creao l'errore da passare a httpExeptionFilter
		if (exception.code === 'P2002')
		{
			const target = exception.meta?.target;
			const field = Array.isArray(target)?target.join(', '): (typeof target === 'string' ? target : 'field');
			// unisco l'array in una sola stringa oppure se è una stringa e basta ci metto target altrimenti di default ci va field
			// lo faccio perche target puo essere o 1 i piu elementi
			customMessage = `The ${field} is already in use`;
			convertionToHttpError = createHttpException(errors.database.uniqueConstraint, customMessage)
		}
		else if (exception.code === 'P2025')
		{
			const field = exception.meta?.modelName || 'Record';
			customMessage = `The ${field} was not found`;
			convertionToHttpError = createHttpException(errors.database.recordNotFound, customMessage)
		}
		else if (exception.code === 'P2003')
		{
			const field = exception.meta?.modelName || 'User';
			customMessage = `The ${field} key is not valid`;
			convertionToHttpError = createHttpException(errors.database.foreignKeyFailed, customMessage)
		}
		else
		{
			convertionToHttpError = createHttpException(errors.database.generalPrismaError)
		}
		this.httpFilter.catch(convertionToHttpError, host);
	}
	
}


/* 
 ### 1. Proprietà specifiche di Prisma

   Proprietà       │ Tipo               │ Descrizione         │ Esempio
  ─────────────────┼────────────────────┼─────────────────────┼─────────────────────
   code            │ string             │ Il codice           │ 'P2002', 'P2025',
				   │                    │ dell'errore Prisma  │ 'P2003'
				   │                    │ (inizia sempre per  │
				   │                    │ P seguito da 4      │
				   │                    │ cifre). È quello    │
				   │                    │ che usi nei tuoi    │
				   │                    │ if/else.            │

   meta            │ Record<string,     │ La proprietà più    │ { target:
				   │ unknown> |         │ utile: un           │ ['email'],
				   │ undefined          │ dizionario con i    │ modelName: 'User' }
				   │                    │ dettagli variabili  │
				   │                    │ dell'errore         │
				   │                    │ dipendenti dal      │
				   │                    │ codice.             │

   clientVersion   │ string             │ La versione di      │ '5.19.0'
				   │                    │ Prisma Client       │
				   │                    │ attualmente in      │
				   │                    │ esecuzione. Utile   │
				   │                    │ nei log di sistema. │

   batchRequestIdx │ number | undefined │ Se l'errore è       │ 0
				   │                    │ avvenuto dentro una │
				   │                    │ transazione batch   │
				   │                    │ ($transaction([...] │
				   │                    │ )), indica l'indice │
				   │                    │ dell'operazione     │
				   │                    │ fallita (es. 0, 1). │

### 2. Proprietà ereditate da Error (JavaScript standard)

   Proprietà │ Tipo               │ Descrizione
  ───────────┼────────────────────┼─────────────────────────────────────────────────
   message   │ string             │ Messaggio descrittivo generato da Prisma con
			 │                    │ dettagli tecnici (spesso include snippet e
			 │                    │ riferimenti interni).

   name      │ string             │ Vale sempre 'PrismaClientKnownRequestError'.
   stack     │ string | undefined │ Lo stack trace con i file e le righe di codice
			 │                    │ per il debug.

*/