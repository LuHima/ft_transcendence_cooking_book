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
    private extractTokenFromHeader(request: Request): string | undefined 
    {
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        return type === 'Bearer' ? token : undefined;
    }

    // contex: execution e' una classe di nest che contiene i metadati e lo stato 
    // di esecuzione della richiesta corrente. E' tipo un contenitore:
    //1) i dati della richiesta in base al protocollo
    //    A)In ambito http (rest) REST API / Express o Fastify
    async canActivate(context: ExecutionContext): Promise<boolean> 
    {
        const request = context.switchToHttp().getRequest();
        const token = this.extractTokenFromHeader(request);
        if (!token) {
          throw new UnauthorizedException();
        }

    try {
        const payload = await this.jwtService.verifyAsync(token);
        request['user'] = payload;
    }catch {
      throw new UnauthorizedException();
    }
    return true;
    }
}


/* 
 ### 1. I dati della richiesta (in base al protocollo)                              
                                                                                     
  ExecutionContext estende ArgumentsHost, permettendoti di fare il "cast" verso il   
  tipo di protocollo attivo:                                                         
                                                                                     
  #### A. In ambito HTTP (REST API / Express o Fastify)                              
                                                                                     
  Tramite context.switchToHttp() puoi estrarre:                                      
                                                                                     
  • getRequest<Request>(): L'oggetto Request di Express (o Fastify). Contiene:       
      • headers (es. authorization, content-type, cookie)                            
      • body (i dati inviati via POST/PUT)                                           
      • query (parametri query string ?page=1)                                       
      • params (parametri di rotta /users/:id)                                       
      • Proprietà custom iniettate (es. request['user'] = payload come fai in        
      auth.guard.ts:33).                                                             
  • getResponse<Response>(): L'oggetto Response (per manipolare cookie, header o     
  inviare risposte direttamente).                                                    
  • getNext(): La funzione next() del ciclo middleware di Express.                   
                                                                                     
  #### B. In ambito WebSockets                                                       
                                                                                     
  Se la richiesta proviene da un Gateway WebSocket (context.switchToWs()):           
                                                                                     
  • getClient(): Il socket del client connesso (es. Socket.IO socket).               
  • getData(): Il payload del messaggio inviato dal client.                          
                                                                                     
  #### C. In ambito Microservizi (RPC / RabbitMQ / Kafka / Redis)                    
                                                                                     
  Tramite context.switchToRpc():
  
  • getData(): Il payload del messaggio inviato dal broker.
  • getContext(): I metadati del messaggio/canale specifici del transport (routing   
  key, headers RPC, ecc.).
  ──────
  ### 2. I metadati del codice in esecuzione (Reflection)
  
  A differenza di un semplice middleware Express, ExecutionContext sa quale          
  Controller e quale metodo stanno per essere eseguiti:
  
  • context.getClass(): Restituisce la classe del controller corrente (es.           
  UsersController).
  • context.getHandler(): Restituisce il metodo specifico della rotta (es.           
  getProfile() o login()).
  • context.getType(): Restituisce una stringa con il tipo di esecuzione attuale     
  ('http', 'ws', 'rpc', ecc.).
  
  #### A cosa servono getClass() e getHandler()?
  
  Servono soprattutto a leggere i metadati personalizzati tramite Reflector (ad      
  esempio per verificare ruoli @Roles('admin') o rotte pubbliche @Public()):         
  
    // Esempio: verificare se una rotta ha un decoratore personalizzato @Public()    
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [         
      context.getHandler(), // controlla il metodo
      context.getClass(),   // controlla la classe (controller)
    ]);
  ──────
  ### Riepilogo schematico
  
   Metodo / Proprietà        │ Valore / Oggetto ottenuto │ Caso d'uso principale
  ───────────────────────────┼───────────────────────────┼───────────────────────────
   context.switchToHttp().ge │ Oggetto Request (headers, │ Estrarre token JWT,
   tRequest()                │ body, query, user, ip)    │ leggere cookie, validare
                             │                           │ l'utente
   context.switchToHttp().ge │ Oggetto Response          │ Impostare header o cookie
   tResponse()               │                           │ di risposta
   context.switchToWs().getC │ Connessione Socket        │ Identificare e
   lient()                   │                           │ autenticare un client
                             │                           │ WebSocket
   context.getClass()        │ Riferimento alla classe   │ Leggere
                             │ del Controller            │ annotazioni/decoratori a
                             │                           │ livello di Controller
   context.getHandler()      │ Riferimento alla funzione │ Leggere
                             │ della rotta               │ annotazioni/decoratori a
                             │                           │ livello di singolo
                             │                           │ endpoint
   context.getType()         │ 'http', 'ws', 'rpc'       │ Scrivere guard o
                             │                           │ interceptor polimorfici



*/