import { ApiPropertyOptional } from '@nestjs/swagger';
import { IngredientCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CatalogQueryDto } from './catalog-query.dto';
import { MAX_SEARCH_LENGTH } from '../../common/validators/validation-constants';

/**
 * Query parameter data transfer object for filtering, searching, sorting, and paginating the ingredient catalog.
 */
export class FilterIngredientDto extends CatalogQueryDto {
  /**
   * Case-insensitive substring search across ingredient slugs and translations.
   * @example 'pomodoro'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search across ingredient slugs and translations (max 100 characters)',
    maxLength: MAX_SEARCH_LENGTH,
    example: 'pomodoro',
  })
  override search?: string = undefined;

  /**
   * Filter ingredients by culinary category.
   * @example IngredientCategory.dairy_eggs
   */
  @ApiPropertyOptional({
    description: 'Filter ingredients by culinary category',
    enum: IngredientCategory,
    example: IngredientCategory.dairy_eggs,
  })
  @IsOptional()
  @IsEnum(IngredientCategory)
  category?: IngredientCategory;
}
