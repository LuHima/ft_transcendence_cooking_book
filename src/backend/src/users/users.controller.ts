import { Param, ParseIntPipe, Controller, Get, Patch, Post, Delete, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';


@Controller('users')
export class UsersController 
{
	constructor (private readonly userService: UsersService) {}

    @Get('search')
    async searchUser(name:string, @Query('value') username: string)
    {
        this.userService.findUser(username);
    }

	@Get(':id')
    async getUser(@Param('id', ParseIntPipe) id: number)
    {
        this.userService.getUser(id);
    }

}
