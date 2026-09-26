import {CanActivate, ExecutionContext, Injectable, UnauthorizedException,} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  // CanActivate e' una interfaccia che ti obbliga a dichiarare un metodo canActivate 
  // al fine di vedere se il token JWT e' valido
  constructor(private readonly jwtService: JwtService) {}
  //jwtService e' l'oggetto attraverso cui usiamo i metodi di JWT per verificare il token
  //visto che contiene la chiave segreta

  //e un metodo che chiamiamo dopo aver creato la Variabile request 
  // dalla richiesta HTTP
/*   Non fa un confronto tra due token memorizzati (perché il token non 
  è salvato da nessuna parte).
  
  Un JWT è composto da 3 parti separate da punti: HEADER . PAYLOAD . 
  SIGNATURE
  
	eyJhbGciOiJIUzI1Ni... . eyJzdWIiOjEsInVzZXJu... . 4Zl5d9k...     
		   [Header]                 [Payload]            [Firma]     
  
  Quando chiami this.jwtService.verifyAsync(token):
  
  1. Separa i pezzi: Prende l'Header e il Payload ricevuti dal client.
  2. Ricalcola la firma crittografica: Prende il tuo secret (la      
  chiave segreta del backend) e ricalcola la formula: */
	private extractTokenFromHeader(request: Request): string | undefined 
	{
		if(request.cookies?.accessToken) //cookie?  il ? è solo nel caso non vengano passati i cookie non da errore ma non fa l'if e ritorna undefined
		{
			return request.cookies.accessToken;
		}
		return undefined;
	}

	async canActivate(context: ExecutionContext): Promise<boolean> 
	{
		const request = context.switchToHttp().getRequest(); // sto pigliando la richiesta http è basta qui.
		const token = this.extractTokenFromHeader(request);
		if (!token) {
		  throw new UnauthorizedException();
		}

		try {
			const payload = await this.jwtService.verifyAsync(token);
			
			request['user'] = {
				id: payload.sub,
				username: payload.username,
				role: payload.role,
				session: payload.session,
		};
		/*
		request è una variabile/oggetto JavaScript che vive nella RAM del  
		server solo per i pochi millisecondi necessari a gestire quella    
		specifica chiamata. AuthGuard ci "appiccica" sopra i dati          
		dell'utente per passarli comodamente alle funzioni successive.
		*/
		}catch {
			throw new UnauthorizedException();
		}
		return true;
	}
}