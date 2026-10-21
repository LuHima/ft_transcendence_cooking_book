import { GlobalExceptionFilter } from './global.exception.filter';
import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ArgumentsHost,
} from '@nestjs/common';

describe('GlobalExceptionFilter (Centralized Dispatcher)', () => {
  let filter: GlobalExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: '/api/recipes/42', method: 'GET' }),
      }),
    } as any;

    loggerErrorSpy = jest
      .spyOn((filter as any).logger, 'error')
      .mockImplementation(() => {});
    loggerWarnSpy = jest
      .spyOn((filter as any).logger, 'warn')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Prisma Client Known Request Errors', () => {
    it('handles P2002 unique constraint violation and formats field message', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '5.19.0',
          meta: { target: ['email'] },
        },
      );

      filter.catch(error, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(409);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 409,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: 'The email is already in use',
      });
    });

    it('handles P2025 record not found and formats 404 message', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record not found',
        {
          code: 'P2025',
          clientVersion: '5.19.0',
          meta: { modelName: 'Recipe' },
        },
      );

      filter.catch(error, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 404,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: 'The Recipe was not found',
      });
    });

    it('handles P2003 foreign key violation and extracts field name cleanly', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.19.0',
          meta: {
            modelName: 'Recipe',
            field_name: 'recipe_ingredients_ingredient_id_fkey',
          },
        },
      );

      filter.catch(error, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 400,
          message: expect.stringContaining('ingredient_id'),
        }),
      );
    });

    it('handles unhandled Prisma known codes by falling back to 500', () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unknown query syntax',
        {
          code: 'P2999',
          clientVersion: '5.19.0',
        },
      );

      filter.catch(error, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 500,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: 'Database query execution error',
      });
    });
  });

  describe('Prisma Infrastructure Errors', () => {
    it('handles PrismaClientInitializationError (connection drop) without leaking DB strings', () => {
      const error = new Prisma.PrismaClientInitializationError(
        'Can not reach database server at postgresql://user:secret@localhost:5432/db',
        '5.19.0',
      );

      filter.catch(error, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 500,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: 'Internal server error',
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Prisma Infrastructure Error'),
        expect.any(String),
      );
    });
  });

  describe('HttpException Handling', () => {
    it('formats standard 4xx HttpException and logs client warning', () => {
      const exception = new NotFoundException('Recipe not found');

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 404,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: 'Recipe not found',
      });
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Client Error [404]'),
      );
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });

    it('passes array of messages from class-validator DTO validation errors', () => {
      const exception = new BadRequestException({
        statusCode: 400,
        message: ['title should not be empty', 'prep_time must be positive'],
        error: 'Bad Request',
      });

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 400,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: ['title should not be empty', 'prep_time must be positive'],
      });
    });

    it('masks 500 HttpException client message and logs internal error with stack trace', () => {
      const exception = new InternalServerErrorException(
        'Database timeout during query',
      );

      filter.catch(exception, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 500,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: 'Internal server error',
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Database timeout during query'),
        expect.any(String),
      );
    });
  });

  describe('Unhandled Generic Errors', () => {
    it('catches unhandled generic Error, returns 500 envelope, and logs stack trace', () => {
      const unhandledError = new Error('Unexpected runtime exception');

      filter.catch(unhandledError, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 500,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: 'Internal server error',
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Internal Error: Unexpected runtime exception',
        expect.any(String),
      );
    });

    it('catches unknown non-Error thrown objects and returns 500 envelope', () => {
      const unknownThrow = 'String exception';

      filter.catch(unknownThrow, mockHost);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        statusCode: 500,
        timestamp: expect.any(String),
        path: '/api/recipes/42',
        message: 'Internal server error',
      });
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Internal Error: String exception',
        undefined,
      );
    });
  });
});
