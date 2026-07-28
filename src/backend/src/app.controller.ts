import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
//import { get } from 'http';
import { MyQueryService } from './query';



@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService, private readonly queryService: MyQueryService) {}

  @Get('ricette')
	async getRicette()
	{
		return await this.queryService.getAllRecipe();
	}
	@Get('ricetta')
	async getRicetta(name :string)
	{
		return await this.queryService.getRecipe(name);
	}
}
