import { Param, ParseIntPipe, Controller, Get, Patch, Post, Delete, Body, Query, UseFilters } from '@nestjs/common';
import { UsersService } from './users.service';
import { HttpExceptionFilter } from 'src/common/filters/http.exeption.filter';


@Controller('users')
@UseFilters(HttpExceptionFilter)
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
