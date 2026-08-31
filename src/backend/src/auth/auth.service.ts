import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import e from 'express';


// This should be a real class/interface representing a user entity
export type User = any;

@Injectable()
export class AuthService 
{

  constructor(private usersService:UsersService){}

  async signIn(email:string, pass: string)
  {
    const user = await this.usersService.getUserByEmail(email)

    if (user.password_hash !== pass) 
    {
      throw new UnauthorizedException();
    }
    const { password_hash, ...result } = user;
    // TODO: Generate a JWT and return it here
    // instead of the user object
    return result;
  }
}
