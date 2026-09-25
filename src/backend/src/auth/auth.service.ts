import { Injectable, UnauthorizedException, ConflictException, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SignUpUserDto } from 'src/users/dto/signup-user.dto';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { time } from 'console';

interface PayLoadInterface {
		id: number;
		username?: string;
		role?: string
		session? :number
	}

@Injectable()
export class AuthService 
{
	constructor(private usersService: UsersService, private jwtService: JwtService, private prisma: PrismaService){}

	async signIn(email:string, pass: string) : Promise<{ accessToken: string, refreshToken: string }>
	{
		let expiredDate: Date
		let hashedToken: string;
		let refreshToken: string;

		const user = await this.usersService.getUserByEmail(email)
		if (!user || !(await bcrypt.compare(pass, user.password_hash))) 
		{
			throw new UnauthorizedException('invalid password or email');
		}

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
		})
		refreshToken  = await this.jwtService.signAsync({id: user.id, session: jwtSes.id_session}, {secret:  process.env.JWT_REFRESH_SECRET, expiresIn: '7d'})
		hashedToken  = crypto.createHash('sha256').update(refreshToken).digest('hex');
		const decodedPayload = this.jwtService.decode(refreshToken);
		// il payLoadContiene delle informazioni di default oltre a quelle che gli diciamo noi tipo: exipired time
		// decodedPayload.exp * 1000 è cosi lo ottengo in millisencondi che poi new Date converte nella data di scandenza
		expiredDate = new Date(decodedPayload.exp * 1000);
		await this.prisma.jwtSession.update({
			where: { 
				id_session: jwtSes.id_session
			},
			data: {
				hashed_jwt_token: hashedToken,
				expire_time_jwt: expiredDate,
			},
		});
		const payload = { sub: user.id, username: user.username, role: user.role, session:  jwtSes.id_session};
		return {
			accessToken: await this.jwtService.signAsync(payload, {expiresIn: '10m'}),
			refreshToken: refreshToken,
		};


	}

	async signUp(user: SignUpUserDto)
	{
		const CheckUserEmail = await this.usersService.getUserByEmail(user.email.trim().toLocaleLowerCase())
		if(CheckUserEmail){
			throw new ConflictException('Email is already used');
		}
		const CheckUserUser = await this.usersService.getUserByUsername(user.username)
		if(CheckUserUser){
			throw new ConflictException('Username is already used');
		}
		const saltRounds = 10;
		const hashedPassword = await bcrypt.hash(user.password, saltRounds);
		
		try{
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
			})
		}catch(error){
			throw new ConflictException('Email or username already in use'); 
		}
		
	}

	async signOut(id: number)
	{
		await this.prisma.jwtSession.delete({
			where: {
				id_session: id,
			},
		});
	};

	async refreshToken(refreshToken :string)
	{
		let payload :PayLoadInterface; //lascio any perche tanto dovrebbe contenere solo id e la uso solo qui quindi va bene cosi
		// il try è dovuto token che mi passano potrebbe essere scadutto e li verifyAsync lancia una eccezione
		try{
			payload = await this.jwtService.verifyAsync(refreshToken, {
			secret: process.env.JWT_REFRESH_SECRET, // lo faccio perche altrimenti usa la chiave di default per il jwt messa nel auth.module.ts
			});
		}catch { 
			throw new UnauthorizedException('Refresh token scaduto o non valido'); 
		}
		
		const user = await this.usersService.getUserById(payload.id);
		if (!user) {
			throw new UnauthorizedException('Access denied');
		}
		const refreshTokenSession = await this.prisma.jwtSession.findUnique({
			where: {
				id_session: payload.session
			}
		});
		if (!refreshTokenSession) {
			throw new UnauthorizedException('Access denied');
		}
		if(refreshTokenSession.expire_time_jwt.getTime() < Date.now())
		{
			throw new UnauthorizedException('expired access token');
		}
		
		const hashTokenFromUser = crypto.createHash('sha256').update(refreshToken).digest('hex');
		if (hashTokenFromUser !== refreshTokenSession.hashed_jwt_token) {
			throw new UnauthorizedException('invalid access token');
		}

		const newPayload = { sub: user.id, username: user.username, role: user.role, session: refreshTokenSession.id_session };
		return await this.jwtService.signAsync(newPayload, { expiresIn: '10m' });
	}

	async infoUser(id: number)
	{
		const user = await this.prisma.user.findUnique({
			where:
			{
				id: id
			},
			select: {
				username: true,
				avatar_url: true
			}
		});
		return user;
	}
}