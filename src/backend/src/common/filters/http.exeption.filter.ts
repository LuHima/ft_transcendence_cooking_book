import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, Logger } from "@nestjs/common";
import { Response, Request } from 'express';
import { timestamp } from "rxjs";
import { errors, createHttpException } from 'src/common/config/error.config';

@Injectable()
@Catch(HttpException) // catturiamo le eccezioni http
export class HttpExceptionFilter implements ExceptionFilter
{
	private readonly logger = new Logger(HttpExceptionFilter.name);
	// logger è creato per debug funziona un po come console log

	catch(exception: HttpException, host: ArgumentsHost) 
	{
		const ctx = host.switchToHttp(); // gli diciamo cosa eseguire (HTTP in questo caso) 
		const response = ctx.getResponse<Response>(); //	metto nella variabile per gestire la risposta http 
		const request = ctx.getRequest<Request>(); //		salvo la richiesta http
		const status = exception.getStatus(); //			salvo il numero dell'eccezione http
		
		const exceResponse = exception.getResponse();
		// riempio la risposta
		response
			.status(status)
			.json({
				statusCode: status,
				timestamp: new Date().toISOString(), 
				path: request.url,
			})
/* 		let message: string | string[] = errors.common.internalServerError.message; // piglio anche un'array perche i DTO mi ritornano piu errori
		let error: string = errors.common.internalServerError.error; */
  
	}

}