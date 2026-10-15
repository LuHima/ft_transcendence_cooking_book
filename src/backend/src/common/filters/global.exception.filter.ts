import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';
import { createHttpException, errors } from '../config/error.config';

/**
 * Universal exception filter implementing the Centralized Dispatcher pattern.
 * Intercepts all exceptions (Prisma errors, HttpExceptions, runtime Errors)
 * and formats them into the uniform ApiErrorResponseDto envelope.
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];

    // Prisma client errors mapped to 404, 409, etc.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error({
        code: exception.code,
        meta: exception.meta,
        message: exception.message,
        clientVersion: exception.clientVersion,
      });

      const httpError = this.handlePrismaKnownRequestError(exception);
      status = httpError.getStatus();
      const res = httpError.getResponse() as any;
      message = res?.message || 'Database error';
    }
    // Other Prisma errors (i.e. disconnected database)
    else if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      this.logger.error(
        `Prisma Infrastructure Error: ${exception.message}`,
        (exception as any).stack,
      );
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }
    // HTTP exception errors
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exeResponse = exception.getResponse();

      if (status >= 500) {
        // Così non mandiamo al frontend gli errori interni del server
        this.logger.error(
          `Internal Error: ${exception.message}`,
          exception.stack,
        );
        message = 'Internal server error';
      } else {
        this.logger.warn(
          `Client Error [${status}]: ${exception.message} - ${request.method} ${request.url}`,
        );
        if (typeof exeResponse === 'string') {
          message = exeResponse;
        } else {
          // Messo any perché l'oggetto può essere anche un oggetto DTO (che mi
          // passano array di stringhe in message) non solo AppErrorDefinition
          // quindi mi serve che copra più tipi
          const errorObj = exeResponse as any;
          message = errorObj?.message || 'Bad request';
        }
      }
    }
    // Other errors mapped all to '500 internal server error'
    else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const errorMessage =
        exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;

      this.logger.error(`Internal Error: ${errorMessage}`, stack);
      message = 'Internal server error';
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }

  private handlePrismaKnownRequestError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): HttpException {
    if (exception.code === 'P2002') {
      const target = exception.meta?.target;
      const field = Array.isArray(target)
        ? target.join(', ')
        : typeof target === 'string'
          ? target
          : 'field';
      return createHttpException(
        errors.database.uniqueConstraint,
        `The ${field} is already in use`,
      );
    }

    if (exception.code === 'P2025') {
      const field = exception.meta?.modelName || 'Record';
      return createHttpException(
        errors.database.recordNotFound,
        `The ${field} was not found`,
      );
    }

    if (exception.code === 'P2003') {
      let field: string | undefined;
      const adapterErrorCause = (exception.meta?.driverAdapterError as any)
        ?.cause;
      const rawField =
        typeof exception.meta?.field_name === 'string'
          ? exception.meta.field_name
          : typeof adapterErrorCause?.constraint?.index === 'string'
            ? adapterErrorCause.constraint.index
            : typeof adapterErrorCause?.originalMessage === 'string'
              ? adapterErrorCause.originalMessage
              : undefined;

      if (rawField) {
        const fkeyMatch = rawField.match(/([a-zA-Z0-9_]+)_fkey/);
        if (fkeyMatch) {
          const parts = fkeyMatch[1].split('_');
          if (parts.length >= 2 && parts[parts.length - 1] === 'id') {
            field = `${parts[parts.length - 2]}_id`;
          } else {
            field = parts[parts.length - 1];
          }
        } else {
          field = rawField;
        }
      }

      const customMessage = field
        ? `The ${field} key is not valid`
        : 'Related record was not found (foreign key constraint failed)';

      return createHttpException(
        errors.database.foreignKeyFailed,
        customMessage,
      );
    }

    return createHttpException(errors.database.generalPrismaError);
  }
}
