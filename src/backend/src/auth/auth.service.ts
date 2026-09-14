import { Injectable, UnauthorizedException, ConflictException, UseGuards } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SignUpUserDto } from 'src/users/dto/signup-user';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

interface PayLoadInterface {
        id: number;
        username?: string;     
        role?: string;     
    }

@Injectable()
export class AuthService 
{
	constructor(private usersService: UsersService, private jwtService: JwtService, private prisma: PrismaService){}

	async signIn(email:string, pass: string) : Promise<{ accessToken: string, refreshToken: string }>
	{
		const user = await this.usersService.getUserByEmail(email)
		if (!user || !(await bcrypt.compare(pass, user.password_hash))) 
		{
			throw new UnauthorizedException('invalid password or email');
		}
		/* if(user.hashed_refresh_token)
		{
			throw new UnauthorizedException('user already authenticated from antother device');
		} */
		
		const refreshToken  = await this.jwtService.signAsync({id: user.id}, {secret:  process.env.JWT_REFRESH_SECRET, expiresIn: '7d'})
		const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

		await this.prisma.user.update({
			where: {
				id: user.id,
			},
			data: {
				hashed_refresh_token: hashedToken,
			},
		})
		const payload = { sub: user.id, username: user.username, role: user.role };
		return {
			accessToken: await this.jwtService.signAsync(payload, {expiresIn: '10m'}),
			refreshToken: refreshToken,
		};


	}

	async signUp(user: SignUpUserDto)
	{
		const CheckUserEmail = await this.usersService.getUserByEmail(user.email)
		if(CheckUserEmail){
			throw new ConflictException('Email is already used');
		}
		const CheckUserUser = await this.usersService.getUserByUsername(user.username)
		if(CheckUserUser){
			throw new ConflictException('Username is already used');
		}
		const saltRounds = 10;                                              
		const hashedPassword = await bcrypt.hash(user.password, saltRounds);
		
		return await this.prisma.user.create({
		data: {                                                           
			username: user.username,                                        
			email: user.email,                                              
			password_hash: hashedPassword,                                  
		},                                                                
		select: {                                                         
			id: true,                                                       
			username: true,                                                 
			email: true,                                                    
			role: true,                                                     
			created_at: true,                                               
		},})
	}

	async signOut(id: number)
	{
		await this.prisma.user.update({
            where: {
                id: id
            },
			data: {
				hashed_refresh_token: null
			},
        });
	};

	async refreshToken(refreshToken :string)
	{
		let payload :PayLoadInterface; //l ascio any perche tanto dovrebbe contenere solo id e la uso solo qui quindi va bene cosi
		// il token che mi passano potrebbe essere scadutto e li verifyAsync lancia una eccezione
		try{
			payload = await this.jwtService.verifyAsync(refreshToken, {
			secret: process.env.JWT_REFRESH_SECRET, // lo faccio perche senno usa la chiave di default per il jwt messa nel auth.module.ts
			});
		}catch { 
			throw new UnauthorizedException('Refresh token scaduto o non valido'); 
		}
		

		const user = await this.usersService.getUserById(payload.id);                
		if (!user || !user.hashed_refresh_token) {
			throw new UnauthorizedException('Access denied');
		}

		const hashTokenFromUser = crypto.createHash('sha256').update(refreshToken).digest('hex');
		if (hashTokenFromUser !== user.hashed_refresh_token) {
			throw new UnauthorizedException('invalid access token');
		}

		const newPayload = { sub: user.id, username: user.username, role: user.role };
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