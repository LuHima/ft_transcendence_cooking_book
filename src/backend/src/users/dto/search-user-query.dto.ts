import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

export { SortOrder };

/**
 * Sorting field options for community member discovery and search.
 */
export enum UserSortBy {
  username = 'username',
  recipes_count = 'recipes_count',
  created_at = 'created_at',
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
   * Field to sort users by.
   * Contextual default: username if search is specified, recipes_count if omitted.
   * @example UserSortBy.recipes_count
   */
  @ApiPropertyOptional({
    enum: UserSortBy,
    description:
      'Field to sort users by. Contextual default: username if search is specified, recipes_count if omitted.',
    example: UserSortBy.recipes_count,
  })
  @IsOptional()
  @IsEnum(UserSortBy)
  sort_by?: UserSortBy;

  /**
   * Sort direction. Defaults contextually to desc for recipes_count and created_at, asc for username.
   * @example SortOrder.desc
   */
  @ApiPropertyOptional({
    enum: SortOrder,
    description:
      'Sort direction. Defaults to desc for recipes_count and created_at, asc for username.',
    example: SortOrder.desc,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder;
}
