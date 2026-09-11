import { Controller, Delete, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInUserDto } from 'src/users/dto/signin-user.dto';
import { SignUpUserDto } from 'src/users/dto/signup-user';
import { Throttle, minutes, seconds } from '@nestjs/throttler';
import { AuthGuard } from 'src/common/guards/auth.guard';

@Controller('auth')
export class AuthController
{
	constructor(private authService: AuthService){} 

	@Throttle({ default: { limit: 5, ttl: minutes(1)}})
	@HttpCode(HttpStatus.OK) // per forzare lo status 200 piustosto che 201 che e' lo status di creazione 201
	@Post('signin')
	signIn(@Body() signInDto: SignInUserDto)
	{
		return this.authService.signIn(signInDto.email, signInDto.password);
	}

	@Throttle({ default: { limit: 3, ttl: minutes(10)}}) 
	@Post('signup')
	signUp(@Body() signUpDto: SignUpUserDto)
	{
		return this.authService.signUp(signUpDto);
	}

	@UseGuards(AuthGuard) 
	@Delete('signout')
	signOut(@Body() signUpDto: SignUpUserDto)
	{
		return this.authService.signOut();
	}

	/*
	@HttpCode(HttpStatus.OK)   
	@Post('refresh')                                                 
	async refresh(@Body('refreshToken') refreshToken: string) {      
																
		return this.authService.refreshAccessToken(refreshToken);      
	} */
}
