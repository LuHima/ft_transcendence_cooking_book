import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SignUpUserDto } from 'src/users/dto/signup-user';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';


@Injectable()
export class AuthService 
{

  constructor(private usersService: UsersService, private jwtService: JwtService, private prisma: PrismaService){}

  async signIn(email:string, pass: string) : Promise<{ access_token: string }>
  {
    const user = await this.usersService.getUserByEmail(email)
    if (!user || !(await bcrypt.compare(pass, user.password_hash))) 
    {
      throw new UnauthorizedException('invalid password or email');
    }
    const payload = { sub: user.id, username: user.username, role: user.role };
    return {
      access_token: await this.jwtService.signAsync(payload),
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
}
