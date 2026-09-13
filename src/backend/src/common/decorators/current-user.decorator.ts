import { Role } from '@prisma/client';
import { createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common';
// createParamDecorator permette di passare parametri al decoratore
// ExecutionContext serve a dare il contesto di esecuzione di NestJS 
// dove posso estrare la richiesta http


/* 
    keyof è un operatore di tipo di TypeScript che estrae l'unione di
    tutte le chiavi (proprietà) di un'interfaccia o tipo.            
                                   
    definendo questo

        export interface ActiveUserData {                              
        id: number;                                                  
        username: string;                                            
        role: Role;                                                  
        }                                                              
                                                                    
    Applicare keyof ActiveUserData equivale a:                       
                                                                    
        'id' | 'username' | 'role'                                     
                                                                    
*/
export interface ActiveUserData {                              
    id: number;
    username: string;
    role: Role;
}

/*
	Da quello che ho capito quando faccio una chiamata API nella ram salvo la chiamata http
  	Nel guard controllo i cookie per il JWT e salvo nella chiamata http della ram  id,
  	username, role e poi nel decoratore li rileggo per pigliare il payload che ho salvato nel
  	Guard, appena risponde al frontend con un return distrugge quell'oggetto
*/
export const CurrentUser = createParamDecorator(
    
    (data: keyof ActiveUserData | undefined, ctx: ExecutionContext) => {
/* 		
		1. ctx (ExecutionContext): NestJS è un framework polivalente. Può gestire sia normali  
		chiamate web (HTTP), sia connessioni in tempo reale (WebSockets), sia code di messaggi 
		(Microservizi). ctx è il "contenitore universale" di NestJS.
		2. .switchToHttp(): Dice a NestJS: "Guarda che stiamo gestendo una normale chiamata web
		HTTP (REST), trattala come tale".
		3. .getRequest(): Estrae l'oggetto Request di Express. È lo stesso identico oggetto che
  		contiene headers, cookies, body, params, ecc.
 */
        const request = ctx.switchToHttp().getRequest(); //acceddo all

		/*
		prima, durante l'esecuzione, il tuo auth.guard.ts:52 ha fatto questo lavoro:
        request.user = { id: payload.sub, username: payload.username, role: payload.role 
	    };*/
        const user = request.user;
		// controllo se ritornare username, id, role oppure tutto user
        if (data) {                                                
          return user ? user[data] : undefined;                    
        }
        return user;
    }




);