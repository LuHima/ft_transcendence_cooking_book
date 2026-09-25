import { Catch, ExceptionFilter } from "@nestjs/common";
import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';
import { errors, createHttpException } from 'src/common/config/error.config';


@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter
{

}