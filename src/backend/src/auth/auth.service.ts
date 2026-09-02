import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';


// This should be a real class/interface representing a user entity
export type User = any;

@Injectable()
export class AuthService 
{

  constructor(private usersService: UsersService, private jwtService: JwtService){}

  async signIn(email:string, pass: string) : Promise<{ access_token: string }>
  {
    const user = await this.usersService.getUserByEmail(email)

    if (user.password_hash !== pass) 
    {
      throw new UnauthorizedException();
    }
    const payload = { sub: user.id, username: user.username };
    return {
      access_token: await this.jwtService.signAsync(payload),};  
  }
}
