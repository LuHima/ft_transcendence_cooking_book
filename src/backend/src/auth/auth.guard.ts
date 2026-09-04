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
