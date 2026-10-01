import { Param, ParseIntPipe, Controller, Get, Patch, Post, Delete, Body, Query, UseFilters } from '@nestjs/common';
import { UsersService } from './users.service';
import { HttpExceptionFilter } from 'src/common/filters/http.exeption.filter';
import { Auth } from 'src/common/decorators/policies.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';

@Controller('users')
@UseFilters(HttpExceptionFilter)
export class UsersController 
{
	constructor (private readonly userService: UsersService) {}

	@Auth()
	@Get('me')
	async getMe(@CurrentUser('id') id: number)
	{
		return await this.userService.getMe(id);
	}

	@Get('search')
	async searchUser(@Query('value') username: string)
	{
		return await this.userService.findUser(username);
	}

	@Get(':id')
	async getUser(@Param('id', ParseIntPipe) id: number)
	{
		return await this.userService.getUser(id);
	}

}
