import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  RecipeSortBy,
  RecipeSortOrder,
} from '../../recipe/dto/filter-recipe.dto';

export { RecipeSortBy, RecipeSortOrder };

/**
 * Query parameter DTO for paginated user cookbook endpoints (liked recipes and authored recipes).
 */
export class UserCookbookQueryDto extends PaginationQueryDto {
  /**
   * Target localization language (it, en, fr). Defaults to author source_lang or system fallback if omitted.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Target localization language (it, en, fr). Defaults to author source_lang or system fallback if omitted.',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @IsOptional()
  @IsString()
  @IsIn(['it', 'en', 'fr'], {
    message: 'lang must be one of the following values: it, en, fr',
  })
  lang?: 'it' | 'en' | 'fr';

  /**
   * Field to sort recipes by (defaults to "created_at").
   * @example RecipeSortBy.created_at
   */
  @ApiPropertyOptional({
    description: 'Field to sort recipes by (defaults to "created_at")',
    enum: RecipeSortBy,
    default: RecipeSortBy.created_at,
    example: RecipeSortBy.created_at,
  })
  @IsOptional()
  @IsEnum(RecipeSortBy)
  sort_by?: RecipeSortBy = RecipeSortBy.created_at;

  /**
   * Sort direction. Defaults contextually to "desc" for created_at and likes_count, "asc" for total_time, difficulty, and title.
   * @example RecipeSortOrder.desc
   */
  @ApiPropertyOptional({
    description:
      'Sort direction. Defaults to "desc" for created_at and likes_count, "asc" for total_time, difficulty, and title',
    enum: RecipeSortOrder,
    example: RecipeSortOrder.desc,
  })
  @IsOptional()
  @IsEnum(RecipeSortOrder)
  sort_order?: RecipeSortOrder;
}
