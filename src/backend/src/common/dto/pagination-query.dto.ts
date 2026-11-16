import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { INT32_MAX } from '../validators/validation-constants';

/**
 * Common query parameters for collection pagination.
 */
export class PaginationQueryDto {
  /**
   * 1-based page window index.
   * @example 1
   */
  @ApiPropertyOptional({
    description: '1-based page window index',
    default: 1,
    minimum: 1,
    maximum: INT32_MAX,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number' })
  @Min(1, { message: 'page must be at least 1' })
  @Max(INT32_MAX, { message: `page cannot exceed ${INT32_MAX}` })
  page?: number = 1;

  /**
   * Number of items per page window (clamped between 1 and 100).
   * @example 20
   */
  @ApiPropertyOptional({
    description: 'Number of items per page window (1 to 100)',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be a whole number' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit?: number = 20;
}

/**
 * Standard 7-field paginated collection envelope.
 */
export interface PaginatedEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

/**
 * Wraps a slice of items with standard 7-field pagination metadata.
 */
export function buildPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedEnvelope<T> {
  const total_pages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    items,
    total,
    page,
    limit,
    total_pages,
    has_next_page: total > 0 && page < total_pages,
    has_prev_page: total > 0 && page > 1,
  };
}
