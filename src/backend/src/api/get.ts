import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AppService } from '../app.service';
//import { get } from 'http';
import { MyQueryService } from '../handler/query';



@Controller('api')
export class GetController {
  constructor(private readonly appService: AppService, private readonly queryService: MyQueryService) {}

  @Get('recipes')
	async getRicette()
	{
		return await this.queryService.getAllRecipe();
	}
	@Get('recipe/:name')
	async getRicetta(@Param('name') name: string)
	{
		return await this.queryService.getRecipe(name);
	}
}