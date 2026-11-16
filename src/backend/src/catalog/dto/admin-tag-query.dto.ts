import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';
import { trimToUndefined } from '../../common/dto/string-transforms';
import { MAX_SEARCH_LENGTH } from '../../common/validators/validation-constants';

/**
 * Query parameters for administrative paginated tag listing.
 */
export class AdminTagQueryDto extends PaginationQueryDto {
  /**
   * Case-insensitive substring search across tag slugs and translations (it, en, fr).
   * @example 'vegan'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search across tag slugs and translations (it, en, fr; max 100 characters)',
    maxLength: MAX_SEARCH_LENGTH,
    example: 'vegan',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'search query must be a text string' })
  @MaxLength(MAX_SEARCH_LENGTH, {
    message: `search query cannot exceed ${MAX_SEARCH_LENGTH} characters`,
  })
  search?: string;

  /**
   * Field to sort results by.
   * @example 'id'
   */
  @ApiPropertyOptional({
    description: 'Field to sort results by',
    enum: ['id', 'slug'],
    default: 'id',
    example: 'id',
  })
  @IsOptional()
  @IsIn(['id', 'slug'], { message: 'sort_by must be either id or slug' })
  sort_by?: 'id' | 'slug' = 'id';

  /**
   * Sort direction (asc or desc).
   * @example SortOrder.asc
   */
  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    default: SortOrder.asc,
    example: SortOrder.asc,
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: 'sort_order must be asc or desc' })
  sort_order?: SortOrder = SortOrder.asc;
}
