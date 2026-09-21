import { Catch, ExceptionFilter } from "@nestjs/common";
//import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';

@Catch(HttpExceptionFilter)
export class HttpExceptionFilter
{

}