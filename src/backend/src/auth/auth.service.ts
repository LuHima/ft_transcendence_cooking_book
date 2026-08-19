
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';


// This should be a real class/interface representing a user entity
export type User = any;

@Injectable()
export class AuthService 
{
  constructor(private UsersService:UsersService){}

  async check(user:string, password: string) Promise<any>
  {

    return true;
  }
}

/* export class UsersService {
  private readonly users = [
    {
      userId: 1,
      username: 'john',
      password: 'changeme',
    },
    {
      userId: 2,
      username: 'maria',
      password: 'guess',
    },
  ];

  async findOne(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }
} */
