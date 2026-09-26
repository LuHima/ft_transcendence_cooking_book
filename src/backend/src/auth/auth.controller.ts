import { Controller, Delete, Post, Body, Res, Get, Req, HttpCode, HttpStatus, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInUserDto } from 'src/users/dto/signin-user.dto';
import { SignUpUserDto } from 'src/users/dto/signup-user.dto';
import { Throttle, days, minutes } from '@nestjs/throttler';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { Response, Request } from 'express';

/* 
Aggiungendo type, comunichiamo a TypeScript che Response serve esclusivamente per il      
  controllo dei tipi e di non tentare di emettere metadati a runtime
*/
@Controller('auth')
export class AuthController
{
	constructor(private authService: AuthService){} 

	@HttpCode(HttpStatus.OK) // per forzare lo status 200 piustosto che 201 che e' lo status di creazione 201 e il post ritorna 201 di default
	@Post('signin')
	async signIn(@Body() signInDto: SignInUserDto, @Res({ passthrough: true }) response: Response,)
	{
		const jwts = await this.authService.signIn(signInDto.email, signInDto.password);
		response.cookie('accessToken', jwts.accessToken, {
			httpOnly: true,
			secure: true, // li invia solo su connessioni protetta (HTTPS)
			sameSite: 'strict',	// non invia i codice se la richiesta non parte dallo stesso sito
			maxAge: minutes(10), 
			path: '/',			// Valido per tutti i path
		})
		// è normale si vedeno negli header e non siano nascosti però sono protetti da httpOnly che impedisce a script di toccarli o vederli
		response.cookie('refresh_token', jwts.refreshToken, {
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			maxAge: days(7),
			path: '/api/auth/refresh',			// Il browser lo invia solo a questa API
	});
	return {
	 	 message: 'Authentication append with success',
   		};
	}

	@Post('signup')
	async signUp(@Body() signUpDto: SignUpUserDto)
	{
		return this.authService.signUp(signUpDto);
	}
/* 
	• @Req() (Request): serve a leggere la richiesta in arrivo inviata dal client (es. i   
	dati che ricevi, l'IP, gli header in entrata). (richiesta http in arrivo)
	• @Res() (Response): serve a preparare la risposta in uscita che il server restituisce 
	al client (es. settare cookie, aggiungere header di risposta). (risposta http in unscita)
	il passthrough serve per rendere meno meccanico le risposte altrimenti 
	è obbligatorio  esplicitare a mano in ogni punto del metodo come chiudere la risposta (res.status(200).json(...)). Se ti dimentichi di farlo, la        
  	risposta non parte. 
	Con { passthrough: true }, imposti solo il cookie e poi lasci fare a NestJS:basta fare return { ... } e NestJS si occuperà di chiudere e inviare la risposta.
*/
	@UseGuards(AuthGuard)
	@Delete('signout')
	async signOut(@CurrentUser('session') id: number, @Res({ passthrough: true }) res: Response)
	{
		await this.authService.signOut(id);
		res.clearCookie('accessToken', { path: '/' });
		res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
		return { message: 'Signed out successfully' };
	}

	@UseGuards(AuthGuard)
	@HttpCode(HttpStatus.OK)
	@Post('refresh')
	async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
		const refreshToken = req.cookies?.['refresh_token'];
		if (!refreshToken) {
			throw new UnauthorizedException('Refresh token missing');
		}
		const newAccessToken= await this.authService.refreshToken(refreshToken);
		
		res.cookie('accessToken', newAccessToken, {
			httpOnly: true,
			secure: true,
			sameSite: 'strict',
			maxAge: minutes(10),
			path: '/',
		});
		return { message: 'Token refreshed successfully' }; 
	}

	@UseGuards(AuthGuard)
	@Get('user')
	async infoMe(@CurrentUser('id') id :number)
	{
		return (await this.authService.infoUser(id));
	}

}
