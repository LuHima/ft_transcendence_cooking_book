import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AppService } from './app.service';
//import { get } from 'http';
import { MyQueryService } from './handler/query';



@Controller('test')
export class AppController {
  constructor(private readonly appService: AppService, private readonly queryService: MyQueryService) {}

}


