import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';


// This should be a real class/interface representing a user entity
export type User = any;

@Injectable()
export class AuthService 
{

  constructor(private usersService:UsersService){}

  async signIn(username:string, pass: string)
  {
    const user = await this.usersService.getUser(1);
    if (user.password !== pass) {
      throw new UnauthorizedException();
    }
    const { password, ...result } = user;
    // TODO: Generate a JWT and return it here
    // instead of the user object
    return result;
  }
}
