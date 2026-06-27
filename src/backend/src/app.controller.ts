import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { get } from 'http';

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('ricette')
	getRicette()
	{
		return{
			stato: "successo",
			ricette:[
				{ id: 1, titolo: "Carbonara", difficolta: "Media" },
        		{ id: 2, titolo: "Tiramisù", difficolta: "Facile" }
			]
		}
	}
}
