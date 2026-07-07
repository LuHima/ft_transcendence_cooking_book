import { PrismaService } from '../../../prisma/prisma.service';
import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from '../../app.service';
import { get } from 'http';


@Controller('api/get') // <--- QUESTO È IL SEGNALE!
export class GetController {
	constructor(private readonly prisma: PrismaService) {}
}
