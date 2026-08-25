
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';


// This should be a real class/interface representing a user entity
export type User = any;

@Injectable()
export class AuthService 
{
  constructor(private UsersService:UsersService){}

  async check(user:string, password: string)
  {
    return true;
  }
}
