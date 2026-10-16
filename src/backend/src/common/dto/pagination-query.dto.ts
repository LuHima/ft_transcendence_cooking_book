import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

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
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
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
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
