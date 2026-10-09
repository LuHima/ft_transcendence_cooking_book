import { ApiProperty } from '@nestjs/swagger';

/**
 * Standardized API error response payload returned by HttpExceptionFilter.
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
   * @example '2026-10-09T17:30:00.000Z'
   */
  @ApiProperty({
    description: 'ISO 8601 formatted timestamp of when the error occurred',
    example: '2026-10-09T17:30:00.000Z',
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
   * @example 'Recipe not found'
   */
  @ApiProperty({
    description: 'Error description or list of validation error messages',
    oneOf: [
      { type: 'string', example: 'Recipe not found' },
      {
        type: 'array',
        items: { type: 'string' },
        example: ['Title must be at least 3 characters long'],
      },
    ],
  })
  message: string | string[];
}
