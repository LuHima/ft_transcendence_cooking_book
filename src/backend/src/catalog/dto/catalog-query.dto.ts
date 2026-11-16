import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { SupportedLocale } from '../../common/dto/locale-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';
import { trimToUndefined } from '../../common/dto/string-transforms';
import {
  MAX_SEARCH_LENGTH,
  SUPPORTED_LOCALES,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

/**
 * Shared neutral query DTO for paginated, localized public catalog endpoints.
 */
export class CatalogQueryDto extends PaginationQueryDto {
  /**
   * Target localization language (it, en, fr). Defaults to 'en' if omitted.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Target localization language (it, en, fr). Defaults to English if omitted.',
    enum: SUPPORTED_LOCALES,
    example: 'it',
  })
  @IsOptional()
  @IsString({ message: 'lang must be a text string' })
  @IsIn(SUPPORTED_LOCALES, { message: VALIDATION_MESSAGES.langUnsupported })
  lang?: SupportedLocale;

  /**
   * Case-insensitive substring search across slugs and translations.
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search across slugs and translations (max 100 characters)',
    maxLength: MAX_SEARCH_LENGTH,
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
   * @example 'name'
   */
  @ApiPropertyOptional({
    description: 'Field to sort results by',
    enum: ['slug', 'name'],
    default: 'name',
    example: 'name',
  })
  @IsOptional()
  @IsIn(['slug', 'name'], { message: 'sort_by must be either slug or name' })
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
  @IsEnum(SortOrder, { message: 'sort_order must be asc or desc' })
  sort_order?: SortOrder = SortOrder.asc;
}
