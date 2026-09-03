import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AppService } from './app.service';
//import { get } from 'http';



@Controller('test')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}


