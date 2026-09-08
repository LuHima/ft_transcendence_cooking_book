import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from 'src/users/dto/login-user.dto';
import { SignInUserDto } from 'src/users/dto/signin-user.dto';


@Controller('auth')
export class AuthController
{
  constructor(private authService: AuthService){} 

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  signIn(@Body() signInDto: SignInUserDto)
  {
    return this.authService.signIn(signInDto.email, signInDto.password);
  }
}
