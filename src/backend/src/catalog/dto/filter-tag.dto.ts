import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import type { SupportedLocale } from '../../common/dto/locale-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

/**
 * Query parameter data transfer object for filtering, searching, sorting, and paginating the tag catalog.
 */
export class FilterTagDto extends PaginationQueryDto {
  /**
   * Target localization language (it, en, fr). Defaults to 'en' if omitted.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Target localization language (it, en, fr). Defaults to English if omitted.',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @IsOptional()
  @IsString()
  @IsIn(['it', 'en', 'fr'], {
    message: 'lang must be one of the following values: it, en, fr',
  })
  lang?: SupportedLocale;

  /**
   * Case-insensitive substring search across tag slugs and translations.
   * @example 'vegan'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search across tag slugs and translations',
    example: 'vegan',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Field to sort results by.
   * @example 'name'
   */
  @ApiPropertyOptional({
    description: 'Field to sort results by',
    enum: ['slug', 'name'],
    default: 'name',
    example: 'name',
  })
  @IsOptional()
  @IsIn(['slug', 'name'])
  sort_by?: 'slug' | 'name' = 'name';

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
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.asc;
}
