import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';
import { trimToUndefined } from '../../common/dto/string-transforms';
import { MAX_SEARCH_LENGTH } from '../../common/validators/validation-constants';

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
      'Search query substring matching username, first_name, or last_name (2-100 non-whitespace characters)',
    example: 'mario',
    minLength: 2,
    maxLength: MAX_SEARCH_LENGTH,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'search query must be a text string' })
  @MinLength(2, { message: 'search query must be at least 2 characters' })
  @MaxLength(MAX_SEARCH_LENGTH, {
    message: `search query cannot exceed ${MAX_SEARCH_LENGTH} characters`,
  })
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
  @IsEnum(UserSortBy, { message: 'Invalid sort_by value' })
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
  @IsEnum(SortOrder, { message: 'sort_order must be asc or desc' })
  sort_order?: SortOrder;
}
