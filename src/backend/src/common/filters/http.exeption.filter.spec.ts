import { HttpExceptionFilter } from './http.exeption.filter';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  ArgumentsHost,
} from '@nestjs/common';

describe('HttpExceptionFilter (Catch-All Exception Filter)', () => {
  let filter: HttpExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
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

  it('handles array messages from class-validator DTO validation errors', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      message: [
        'title should not be empty',
        'prep_time must be a positive number',
      ],
      error: 'Bad Request',
    });

    filter.catch(exception, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: 400,
      timestamp: expect.any(String),
      path: '/api/recipes/42',
      message: [
        'title should not be empty',
        'prep_time must be a positive number',
      ],
    });
  });

  it('masks 500 HttpException message from client and logs internal error with stack trace', () => {
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

  it('catches unhandled generic Error, returns 500 envelope, and logs stack trace', () => {
    const unhandledError = new Error('Unexpected connection termination');

    filter.catch(unhandledError, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: 500,
      timestamp: expect.any(String),
      path: '/api/recipes/42',
      message: 'Internal server error',
    });
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Internal Error: Unexpected connection termination',
      expect.any(String),
    );
  });

  it('catches unknown non-Error thrown objects and returns 500 envelope', () => {
    const unknownThrow = 'String failure';

    filter.catch(unknownThrow, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({
      statusCode: 500,
      timestamp: expect.any(String),
      path: '/api/recipes/42',
      message: 'Internal server error',
    });
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Internal Error: String failure',
      undefined,
    );
  });
});
