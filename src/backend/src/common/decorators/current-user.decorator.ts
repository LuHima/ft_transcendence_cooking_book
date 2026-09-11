import { Role } from '@prisma/client';
import { createParamDecorator, ExecutionContext, Injectable } from '@nestjs/common';
// createParamDecorator permette di passare parametri al decoratore
// ExecutionContext serve a dare il contesto di esecuzione di NestJS 
// dove posso estrare la richiesta http

// Definisco una interfaccia di cosa puo contenere l'utente all'interno del JWT

/* 
    keyof è un operatore di tipo di TypeScript che estrae l'unione di
    tutte le chiavi (proprietà) di un'interfaccia o tipo.            
                                                                    
    Nel tuo codice hai definito:                                     
                                                                    
        export interface ActiveUserData {                              
        id: number;                                                  
        username: string;                                            
        role: Role;                                                  
        }                                                              
                                                                    
    Applicare keyof ActiveUserData equivale a:                       
                                                                    
        'id' | 'username' | 'role'                                     
                                                                    
    Vantaggio:                                                       
    Fornisce type safety e autocompletamento:                        

    • Se viene scritto @CurrentUser('username'), TypeScript lo accetta.     
    • Se viene scritto un refuso come @CurrentUser('mail'), TypeScript      
    segnalerà subito un errore di compilazione perché 'mail' non è   
    una chiave valida di current-user.decorator.ts:8-12.

   La funzione riceve due argomenti:                                                                                           
        1. data: è il valore che chi usa il decoratore può eventualmente 
        passare tra parentesi nel controller.                            
      • Tipo: keyof ActiveUserData | undefined                     
      • Se nel controller viene passato @CurrentUser('id'), data varrà 'id'. 
      • Se si usa @CurrentUser(), data sarà undefined.
    */

//@Injectable()
export interface ActiveUserData {                              
    id: number;                                                  
    username: string;                                            
    role: Role;                                                  
}

export const CurrentUser = createParamDecorator(
    
    (data: keyof ActiveUserData | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;
        /*  
         Se nel controller abbiamo specificato un campo (es.       
        @CurrentUser('id')),                                             
        restituiamo solo quel campo specifico   
        */                 
        if (data) {                                                
          return user ? user[data] : undefined;                    
        }
        // Altrimenti restituiamo tutto l'oggetto utente
        return user;
    }




);