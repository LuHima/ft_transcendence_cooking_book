import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Sorting options for community member discovery and search.
 */
export enum UserSort {
  username_asc = 'username_asc',
  username_desc = 'username_desc',
  recipes_count_desc = 'recipes_count_desc',
  newest = 'newest',
  oldest = 'oldest',
}

/**
 * Query parameter DTO for community member discovery and search.
 * Extends PaginationQueryDto to support page and limit.
 */
export class SearchUserQueryDto extends PaginationQueryDto {
  /**
   * Search substring matching against username, first name, or last name.
   * Requires at least 2 non-whitespace characters.
   * Whitespace-only strings are normalized to undefined.
   * @example 'mario'
   */
  @ApiPropertyOptional({
    description:
      'Search query substring matching username, first_name, or last_name (minimum 2 non-whitespace characters)',
    example: 'mario',
    minLength: 2,
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'search query must be at least 2 characters' })
  search?: string;

  /**
   * Sorting criteria for member discovery.
   * Contextual default: username_asc if search is specified, recipes_count_desc if omitted.
   * @example UserSort.recipes_count_desc
   */
  @ApiPropertyOptional({
    enum: UserSort,
    description:
      'Sorting criteria for member discovery. Contextual default: username_asc if search is specified, recipes_count_desc if omitted.',
    example: UserSort.recipes_count_desc,
  })
  @IsOptional()
  @IsEnum(UserSort)
  sort?: UserSort;
}
