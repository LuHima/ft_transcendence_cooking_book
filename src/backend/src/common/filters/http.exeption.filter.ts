import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, Logger } from "@nestjs/common";
import { Response, Request } from 'express';
// import { AppErrorDefinition } from "src/common/config/error.config";

@Injectable()
@Catch(HttpException) // catturiamo le eccezioni http
export class HttpExceptionFilter implements ExceptionFilter
{
	private readonly logger = new Logger(HttpExceptionFilter.name);
	// logger è creato per debug funziona un po come console log
	// si vedono nel terminale i log lanciati da questa classe

	catch(exception: HttpException, host: ArgumentsHost) 
	{
		//exception: HttpException quando fai un throw viene e catturato da questa classe viene salvato in questa variabile che contiene l'ecczione es httpExeptionNotFound è salvata in quella variabile
		// host: ArgumentsHost è un wrapper che contiene tutti gli argomenti della chiamata in corso (Che è http in questo caso)
		const ctx = host.switchToHttp(); // gli diciamo cosa eseguire (HTTP in questo caso)
		const response = ctx.getResponse<Response>(); //	metto nella variabile per gestire la risposta http
		const request = ctx.getRequest<Request>(); //		salvo la richiesta http
		const status = exception.getStatus(); //			salvo il numero dell'eccezione http
		
		let exceMsg: string | string[]; // accetto array di stringhe perche i DTO mi ritornano vari messaggi
		const exeResponse = exception.getResponse(); //puo essere una stringa o un oggetto dipenda da cosa passi all'eccezione
		

		if(status >= 500) { // cosi non mandiamo al frontend gli errori interni del server
			this.logger.error(`Internal Error: ${exception.message}`, exception.stack);
			exceMsg = 'Internal server error';
		}
		else
		{
			this.logger.warn(`Client Error [${status}]: ${exception.message} - ${request.method} ${request.url}`);
			if(typeof exeResponse === 'string')
			{
				exceMsg = exeResponse;
			}
			else {
				const errorObj = exeResponse as any;
				// messo any perche l'oggetto puo essere anche un oggetto DTO (che mi passano array di stringhe in message) non solo AppErrorDefinition quindi mi serve che copra piu tipi
				exceMsg =  errorObj?.message || 'Bad request';
			}
		}

		// cosa metto nella risposta
		response
			.status(status)
			.json({
				statusCode: status,
				timestamp: new Date().toISOString(), 
				path: request.url,
				message: exceMsg,
			})
	}

	// HttpException è una classe che 3 parametri HttpException(response, status, options?) 
	// 			response puo essere per o una stringa o un oggetto
	// 			status che è il codice dell'errore
	// 			option puo essere per esempio la causa del problema dipende dal codice


/* 	 
	message			  │ string          │ Proprietà ereditata da
					  │                 │ Error. È una descrizione
					  │                 │ testuale dell'errore
					  │                 │ usata nei log.

	name			  │ string          │ Il nome della classe (es.
					  │                 │ "HttpException" o
					  │                 │ "NotFoundException").

	stack			  │ string          │ Il classico stack trace
					  │                 │ di debug (le righe di
					  │                 │ codice dove è avvenuto
					  │                 │ l'errore).
 */

}
