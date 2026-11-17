import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

export async function resolveActiveJwtUser(
  prisma: PrismaService | undefined,
  payload: Record<string, any>,
) {
  const userId = Number(payload.sub);
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  let username = payload.username;
  let role = payload.role;

  if (prisma) {
    if (prisma.jwtSession?.findUnique) {
      const sessionId =
        typeof payload.session === 'number' ? payload.session : NaN;
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return null;
      }
      const session = await prisma.jwtSession.findUnique({
        where: { id_session: sessionId },
        select: { id_session: true, id_user: true, expire_time_jwt: true },
      });
      if (
        !session ||
        session.id_user !== userId ||
        session.expire_time_jwt <= new Date()
      ) {
        return null;
      }
    }

    if (prisma.user?.findUnique) {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { status: true, deleted_at: true, role: true, username: true },
      });
      if (
        !dbUser ||
        dbUser.status !== 'active' ||
        dbUser.deleted_at !== null
      ) {
        return null;
      }
      role = dbUser.role;
      username = dbUser.username;
    }
  }

  return {
    id: userId,
    username,
    role,
    session: payload.session,
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  // CanActivate e' una interfaccia che ti obbliga a dichiarare un metodo canActivate
  // al fine di vedere se il token JWT e' valido
  constructor(
    private readonly jwtService: JwtService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}
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
  private extractTokenFromHeader(request: Request): string | undefined {
    if (
      request.cookies?.accessToken
    ) //cookie?  il ? è solo nel caso non vengano passati i cookie non da errore ma non fa l'if e ritorna undefined
    {
      return request.cookies.accessToken;
    }
    return undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest(); // sto pigliando la richiesta http è basta qui.
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (!payload.sub || payload.type !== 'access')
        // questo controllo serve per il tempToken visto che verify non sa che tipo di token è sa solo se è valido
        throw new UnauthorizedException(); // quindi io gli dico che non deve essere un token 2Factorr
      // !payload.sub lo controllo perche altrimeti non funziona la creazione sotto non centra con il 2factor

      const activeUser = await resolveActiveJwtUser(this.prisma, payload);
      if (!activeUser) {
        throw new UnauthorizedException();
      }
      request['user'] = activeUser;
      /*
		request è una variabile/oggetto JavaScript che vive nella RAM del
		server solo per i pochi millisecondi necessari a gestire quella
		specifica chiamata. AuthGuard ci "appiccica" sopra i dati
		dell'utente per passarli comodamente alle funzioni successive.
		*/
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
