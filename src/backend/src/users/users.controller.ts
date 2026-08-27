import { Controller, Get, Patch, Post, Delete, Body, Query } from '@nestjs/common';

@Controller('users')
export class UsersController 
{
    @Get('search')
    async getUser(name:string, @Query('value') username: string)
    {
        
    }

}
