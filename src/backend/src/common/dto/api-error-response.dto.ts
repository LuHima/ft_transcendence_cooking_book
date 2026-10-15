import { ApiProperty } from '@nestjs/swagger';

/**
 * Standardized API error response payload returned by GlobalExceptionFilter.
 */
export class ApiErrorResponseDto {
  /**
   * HTTP status code representing the error category.
   * @example 400
   */
  @ApiProperty({
    description: 'HTTP status code representing the error category',
    example: 400,
  })
  statusCode: number;

  /**
   * ISO 8601 formatted timestamp of when the error occurred.
   * @example '2026-10-14T10:00:00.000Z'
   */
  @ApiProperty({
    description: 'ISO 8601 formatted timestamp of when the error occurred',
    example: '2026-10-14T10:00:00.000Z',
  })
  timestamp: string;

  /**
   * Requested URL path that produced the error.
   * @example '/api/recipes/42'
   */
  @ApiProperty({
    description: 'Requested URL path that produced the error',
    example: '/api/recipes/42',
  })
  path: string;

  /**
   * Error description or list of validation error messages.
   * @example 'Error description'
   */
  @ApiProperty({
    description: 'Error description or list of validation error messages',
    oneOf: [
      { type: 'string', example: 'Error description' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['Field validation failure'],
      },
    ],
  })
  message: string | string[];
}

/**
 * Standard 400 Bad Request error response.
 */
export class ApiBadRequestResponseDto {
  @ApiProperty({
    description:
      'HTTP status code representing client bad request or validation error',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'ISO 8601 formatted timestamp of when the error occurred',
    example: '2026-10-14T10:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Requested URL path that produced the error',
    example: '/api/recipes',
  })
  path: string;

  @ApiProperty({
    description:
      'Validation error description or array of constraint violations',
    oneOf: [
      { type: 'string', example: 'Bad Request' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['Title must be at least 3 characters long'],
      },
    ],
  })
  message: string | string[];
}

/**
 * Standard 401 Unauthorized error response.
 */
export class ApiUnauthorizedResponseDto {
  @ApiProperty({
    description:
      'HTTP status code representing missing or invalid authentication credentials',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: 'ISO 8601 formatted timestamp of when the error occurred',
    example: '2026-10-14T10:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Requested URL path that produced the error',
    example: '/api/recipes',
  })
  path: string;

  @ApiProperty({
    description: 'Authentication failure message',
    example: 'Authentication required: missing or invalid accessToken cookie',
  })
  message: string;
}

/**
 * Standard 403 Forbidden error response.
 */
export class ApiForbiddenResponseDto {
  @ApiProperty({
    description:
      'HTTP status code representing insufficient permissions to perform action',
    example: 403,
  })
  statusCode: number;

  @ApiProperty({
    description: 'ISO 8601 formatted timestamp of when the error occurred',
    example: '2026-10-14T10:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Requested URL path that produced the error',
    example: '/api/recipes/42',
  })
  path: string;

  @ApiProperty({
    description: 'Authorization failure message',
    example:
      'Forbidden: insufficient permissions for this action on the target resource',
  })
  message: string;
}

/**
 * Standard 404 Not Found error response.
 */
export class ApiNotFoundResponseDto {
  @ApiProperty({
    description: 'HTTP status code representing requested resource not found',
    example: 404,
  })
  statusCode: number;

  @ApiProperty({
    description: 'ISO 8601 formatted timestamp of when the error occurred',
    example: '2026-10-14T10:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Requested URL path that produced the error',
    example: '/api/recipes/42',
  })
  path: string;

  @ApiProperty({
    description: 'Resource not found message',
    example: 'Recipe not found',
  })
  message: string;
}

/**
 * Standard 409 Conflict error response.
 */
export class ApiConflictResponseDto {
  @ApiProperty({
    description:
      'HTTP status code representing conflicting state or duplicate resource',
    example: 409,
  })
  statusCode: number;

  @ApiProperty({
    description: 'ISO 8601 formatted timestamp of when the error occurred',
    example: '2026-10-14T10:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Requested URL path that produced the error',
    example: '/api/auth/signup',
  })
  path: string;

  @ApiProperty({
    description: 'Conflict failure message',
    example: 'Username or email is already taken',
  })
  message: string;
}

/**
 * Standard 500 Internal Server Error response.
 */
export class ApiInternalServerErrorResponseDto {
  @ApiProperty({
    description:
      'HTTP status code representing an unhandled internal server error',
    example: 500,
  })
  statusCode: number;

  @ApiProperty({
    description: 'ISO 8601 formatted timestamp of when the error occurred',
    example: '2026-10-14T10:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Requested URL path that produced the error',
    example: '/api/recipes',
  })
  path: string;

  @ApiProperty({
    description: 'Internal server error message',
    example: 'Internal server error',
  })
  message: string;
}

