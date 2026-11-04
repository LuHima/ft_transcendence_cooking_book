import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SignUpUserDto } from 'src/users/dto/signup-user.dto';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as qrcode from 'qrcode';
import { generateSecret, generateURI, verify } from 'otplib';
import { createHttpException, errors } from 'src/common/config/error.config';
import { EncryptionService } from './encryption.service';
import { Prisma, ReportReason, User, UserStatus } from '@prisma/client';
import { isNumber } from 'class-validator';
import { TwoFactorCode } from './auth.controller';
import { TwoFactorAuth } from 'src/users/dto/twoFactor-user.dto';
import { BanHistoryService } from '../reports/ban-history.service';
import { AccountBannedException } from './exceptions/account-banned.exception';
import { OAuth2Client } from 'google-auth-library';

interface PayLoadInterface {
  id: number;
  username?: string;
  role?: string;
  session?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private banHistoryService: BanHistoryService,
  ) {}
  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  // creo il verificatore per google
  // da notare che non uso GOOGLE_CLIENT_SECRET visto che il token che mi passa l'utente è gia un jwt
  // firmato da google, quindi non devo scambiarlo/generarlo io e quindi verifico solo che la firma sia autentica
  // tramite i certificati pubblici di google e il nostro GOOGLE_CLIENT_ID
  // potrei toglierla ma la lascio perche è una cosa carina carina visto che serviva poi per contattare google per 
  // pigliare le informazioni dell'utente, perche un'altro metodo per farla è usare un buono momentaneo passato dall'utente
  private async jwtSessionSignin(user: User) {
    let expiredDate: Date;
    let hashedToken: string;
    let refreshToken: string;

    // cancello la sessione piu vecchia se un utente ha piu di 5 sessioni
    const userSessions = await this.prisma.jwtSession.findMany({
      where: { id_user: user.id },
      orderBy: { id_session: 'asc' },
    });

    if (userSessions.length >= 5) {
      await this.prisma.jwtSession.delete({
        where: { id_session: userSessions[0].id_session },
      });
    }

    const jwtSes = await this.prisma.jwtSession.create({
      data: {
        id_user: user.id,
        hashed_jwt_token: 'temp',
        expire_time_jwt: new Date(Date.now()),
      },
    });
    refreshToken = await this.jwtService.signAsync(
      { id: user.id, session: jwtSes.id_session },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
    );
    hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const decodedPayload = this.jwtService.decode(refreshToken);
    // il payLoadContiene delle informazioni di default oltre a quelle che gli diciamo noi tipo: exipired time
    // decodedPayload.exp * 1000 è cosi lo ottengo in millisencondi che poi new Date converte nella data di scandenza
    expiredDate = new Date(decodedPayload.exp * 1000);
    await this.prisma.jwtSession.update({
      where: {
        id_session: jwtSes.id_session,
      },
      data: {
        hashed_jwt_token: hashedToken,
        expire_time_jwt: expiredDate,
      },
    });

    const payload = {
      sub: user.id,
      username: user.username,
      type: 'access',
      role: user.role,
      session: jwtSes.id_session,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload, {
        expiresIn: '10m',
      }),
      refreshToken: refreshToken,
    };
  }

  private async generateUniqueUsername(payload: {
    given_name?: string;
    family_name?: string;
    email: string;
  }): Promise<string> {
    // creo un username automatico cosi ce l'ha per ferforza

    // Prendo nome e cognome (o l'email come alternativa se non ci sono)
    const rawName =
      payload.given_name && payload.family_name
        ? `${payload.given_name}_${payload.family_name}`
        : payload.given_name || payload.email.split('@')[0];

    const cleanName = rawName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // rimuovo gli accenti coopera con normalize('NFD') per rimuovere completamente l'accento
      .replace(/[^a-zA-Z0-9_-]/g, '_') // trasformo spazi e simboli in "_"
      .toLowerCase()
      .slice(0, 20);

    // Aggiungiungo 3 numeri casuali alal fine
    let uniqueUsername = `${cleanName}_${Math.floor(100 + Math.random() * 900)}`;

    // faccio un while cosi evito duplicati al 100% (Spero), rigenero solo i 3 numberi in fondo
    while (
      await this.prisma.user.findUnique({
        where: { username: uniqueUsername },
      })
    ) {
      uniqueUsername = `${cleanName}_${Math.floor(1000 + Math.random() * 9000)}`;
    }
    return uniqueUsername;
  }

  async twoFactorSignin(authTwoFactor: TwoFactorAuth) {
    const code = authTwoFactor.code;
    const tempToken = authTwoFactor.tempToken;
    let payloads;
    try {
      payloads = await this.jwtService.verifyAsync(tempToken);
    } catch {
      throw createHttpException(errors.auth.accessDenied, 'expired temp token');
    }
    if (!payloads.is2FaPending)
      throw createHttpException(errors.auth.accessDenied);
    const user = await this.prisma.user.findUnique({
      where: { id: payloads.userId },
    });
    if (!user || user.status !== 'active' || user.deleted_at)
      throw createHttpException(errors.auth.accessDenied);
    // decrypto la password nel database
    const twoFactorCodeDecrypted = this.encryptionService.decrypting(
      user.two_factor,
    );
    const isValid = await verify({
      token: code,
      secret: twoFactorCodeDecrypted,
    });
    if (!isValid.valid) throw createHttpException(errors.auth.accessDenied);
    return this.jwtSessionSignin(user);
  }

  async googleSignIn(
    token: string,
  ): Promise<
    | { accessToken: string; refreshToken: string }
    | { tempToken: string; twofAuth: true }
  > {
    let ticket;
    try {
      ticket = await this.googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch {
      throw createHttpException(
        errors.auth.accessDenied,
        'Invalid or expired Google token',
      );
    }
    const payload = ticket.getPayload(); // questo ticket contiene tutte le finormazioni dell'utente(è un json), le salvo in un payload per comodita
    if (!payload || !payload.email) {
      throw createHttpException(
        errors.auth.accessDenied,
        'Invalid Google token payload',
      );
    }
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id_google: payload.sub },
          { email: payload.email.trim().toLowerCase() },
        ],
      },
    });

    if (!user) {
      const username = await this.generateUniqueUsername(payload);
      user = await this.prisma.user.create({
        data: {
          id_google: payload.sub,
          email: payload.email.trim().toLowerCase(),
          username: username,
          first_name: payload.given_name ?? null,
          last_name: payload.family_name ?? null,
          avatar_url: payload.picture ?? null,
        },
      });
    }
    if (user && !user.id_google) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { id_google: payload.sub },
      });
    }
    if (user.status !== 'active' || user.deleted_at) {
      throw createHttpException(errors.users.inactive);
    }
    if (user.is_two_factor_enabled === true) {
      const tempToken = await this.jwtService.signAsync(
        { userId: user.id, is2FaPending: true, type: 'twofactAuth' },
        { expiresIn: '5m' },
      );
      return {
        tempToken: tempToken,
        twofAuth: true,
      };
    }
    return await this.jwtSessionSignin(user);
  }
  async signIn(
    email: string,
    pass: string,
  ): Promise<
    | { accessToken: string; refreshToken: string }
    | { tempToken: string; twofAuth: true }
  > {
    const user = await this.usersService.getUserByEmail(
      email.trim().toLowerCase(),
    );
    if (!user) {
      throw new UnauthorizedException('invalid password or email');
    }
    if (user.deleted_at) {
      throw createHttpException(errors.users.inactive);
    }
    if (user.status === UserStatus.banned) {
      const isTemporary =
        (user as any).banned_until !== null &&
        (user as any).banned_until !== undefined;
      const isExpired =
        isTemporary && new Date((user as any).banned_until) < new Date();

      if (isExpired) {
        // Automatically reactivate expired temporary ban
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            status: UserStatus.active,
            banned_until: null,
          },
        });
        await this.banHistoryService.recordUnban(
          user.id,
          null,
          'Automated expiration upon login',
        );
        user.status = UserStatus.active;
      } else {
        const latestBan = await this.banHistoryService.getLatestActiveBan(
          user.id,
        );
        throw new AccountBannedException({
          reason: latestBan?.reason ?? ReportReason.other,
          description: latestBan?.description ?? null,
          banned_until: (user as any).banned_until ?? null,
          is_permanent:
            latestBan?.is_permanent ??
            ((user as any).banned_until === null ||
              (user as any).banned_until === undefined),
        });
      }
    } else if (user.status !== UserStatus.active) {
      throw createHttpException(errors.users.inactive);
    }
    if (!user.password_hash) {
      throw createHttpException(
        errors.auth.invalidCredentials,
        'This user is authenticated with google',
      );
    }
    if (!(await bcrypt.compare(pass, user.password_hash))) {
      throw new UnauthorizedException('invalid password or email');
    }

    if (user.is_two_factor_enabled === true) {
      // Genero un codice temporaneo per permettere all'utente di fare l'autenticazione a 2 fattori
      // attraverso un'altra API
      const tempToken = await this.jwtService.signAsync(
        { userId: user.id, is2FaPending: true, type: 'twofactAuth' },
        { expiresIn: '5m' },
      );
      return {
        tempToken: tempToken,
        twofAuth: true,
      };
    }
    return this.jwtSessionSignin(user);
  }

  async signUp(user: SignUpUserDto) {
    const CheckUserEmail = await this.usersService.getUserByEmail(
      user.email.trim().toLocaleLowerCase(),
    );
    if (CheckUserEmail) {
      throw new ConflictException('Email is already used');
    }
    const CheckUserUser = await this.usersService.findUserByUsername(
      user.username,
    );
    if (CheckUserUser) {
      throw new ConflictException('Username is already used');
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(user.password, saltRounds);

    return await this.prisma.user.create({
      data: {
        username: user.username,
        email: user.email.trim().toLocaleLowerCase(),
        password_hash: hashedPassword,
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        created_at: true,
      },
    });
  }

  async signOut(id: number) {
    if (!id) return; // per non passarli in alcun caso undefined cancella un po tutto
    await this.prisma.jwtSession.deleteMany({
      where: {
        id_session: id,
      },
    });
  }

  async refreshToken(refreshToken: string) {
    let payload: PayLoadInterface; //lascio any perche tanto dovrebbe contenere solo id e la uso solo qui quindi va bene cosi
    // il try è dovuto token che mi passano potrebbe essere scadutto e li verifyAsync lancia una eccezione
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET, // lo faccio perche altrimenti usa la chiave di default per il jwt messa nel auth.module.ts
      });
    } catch {
      throw createHttpException(
        errors.auth.accessDenied,
        'expired access token or invalid',
      );
    }

    const user = await this.usersService.getUserById(payload.id);
    if (!user || user.status !== 'active' || user.deleted_at) {
      throw createHttpException(errors.auth.accessDenied);
    }
    const refreshTokenSession = await this.prisma.jwtSession.findUnique({
      where: {
        id_session: payload.session,
      },
    });
    if (!refreshTokenSession) {
      throw createHttpException(errors.auth.refreshTokenExpired);
    }
    if (refreshTokenSession.expire_time_jwt.getTime() < Date.now()) {
      throw createHttpException(errors.auth.refreshTokenExpired);
    }

    const hashTokenFromUser = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    if (hashTokenFromUser !== refreshTokenSession.hashed_jwt_token) {
      throw createHttpException(errors.auth.refreshTokenInvalid);
    }

    const newPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      type: 'access',
      session: refreshTokenSession.id_session,
    };
    return await this.jwtService.signAsync(newPayload, { expiresIn: '10m' });
  }

  async verify(id: number, code: string) {
    //		piccola spiegazione della stringa: /^\d{6}$/
    // 		"//" dice di essere un pathern Regex,^ si usa per dire parti dall'inizio
    // 		\d per dire che sono tutti digit, {6} per dire per quanti valori deve ripetersi la regola precedente, $ deve finire subito
    //		dopo l'ultimi check in questo caso {6} dopo sei digit la stringa deve finire
    //		.test() restituisce true o false in base alla riga se è false o vera
    /* if (!/^\d{6}$/.test(code))
			throw createHttpException(errors.auth.accessDenied, 'invalid access code, must be 6 digit'); */
    const user: any = await this.prisma.user.findUnique({
      where: { id: id },
      select: {
        is_two_factor_enabled: true,
        password_hash: true,
        email: true,
        two_factor: true,
      },
    });
    if (!user || !user.two_factor) {
      throw createHttpException(errors.auth.accessDenied);
    }
    if (user.is_two_factor_enabled) {
      throw createHttpException(errors.auth.twoFactorAlreadyEnable);
    }

    const rawSecretCode = this.encryptionService.decrypting(user.two_factor);

    const isValid = await verify({ token: code, secret: rawSecretCode });
    if (!isValid.valid) {
      throw createHttpException(
        errors.auth.accessDenied,
        'invalid access code',
      );
    }
    await this.prisma.user.update({
      where: { id: id },
      data: { is_two_factor_enabled: true },
    });
    return { message: 'Two-factor authentication enabled successfully' };
  }

  /*
	come funziona la twoFactor:
	Ce un codice che viene salvato nel database in un formato con 3 stringhe diverse (che è anche cryptato) per decryptarlo,
	in maniera che in caso di attacco sia protetto e non possa essere ricavato dalla persona attaccante,
	questo codice viene anche dato all'utente (in chiaro) in maniera che lui possa generare codici temporanei sul dispositivo
	in base anche all'ora e verificarli se è uguale al codice che genera il sistema nella stessa identi ora
	per questo hanno durata 30 secondi, va da se che per questo motivo la chiave va protetta nel database

	*/
  async twoFactorAuthEnable(id: number, password: string) {
    const statusTwoFactorAuth: any = await this.prisma.user.findUnique({
      where: { id: id },
      select: { is_two_factor_enabled: true, password_hash: true, email: true },
    });

    if (!statusTwoFactorAuth) {
      throw createHttpException(errors.auth.accessDenied, 'User not found');
    }
    if (statusTwoFactorAuth?.is_two_factor_enabled) {
      throw createHttpException(errors.auth.twoFactorAlreadyEnable);
    }
    if (!(await bcrypt.compare(password, statusTwoFactorAuth.password_hash))) {
      throw createHttpException(errors.auth.accessDenied, 'invalid password');
    }

    //genero la chiave privata
    const key = generateSecret();

    // genera url per authenticator
    const otpAuthUrl = generateURI({
      issuer: 'weCook',
      label: statusTwoFactorAuth.email,
      secret: key,
    });
    // crypto la chiave
    const encryptedKey = this.encryptionService.encrypting(key);

    const qrCode = await qrcode.toDataURL(otpAuthUrl);

    await this.prisma.user.update({
      where: { id: id },
      data: { two_factor: encryptedKey },
    });
    // ritorno la chiave in maniera da permettera la creazione di chiavi temporanee da un'altro dispositivo
    return { qrCode, key };
  }

  async twoFactorAuthDisable(id: number, password: string) {
    const statusTwoFactorAuth: any = await this.prisma.user.findUnique({
      where: { id: id },
      select: { is_two_factor_enabled: true, password_hash: true },
    });

    if (
      !statusTwoFactorAuth ||
      !(await bcrypt.compare(password, statusTwoFactorAuth.password_hash))
    ) {
      throw createHttpException(errors.auth.accessDenied, 'invalid password');
    }

    if (statusTwoFactorAuth?.is_two_factor_enabled === false) {
      throw createHttpException(errors.auth.twoFactorAlreadyDisable);
    }

    await this.prisma.user.update({
      where: { id: id },
      data: { is_two_factor_enabled: false, two_factor: null },
    });
    return { message: 'Two-factor authentication disabled successfully' };
  }
}
