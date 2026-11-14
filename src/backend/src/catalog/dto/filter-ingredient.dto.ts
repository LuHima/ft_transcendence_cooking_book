import { ApiPropertyOptional } from '@nestjs/swagger';
import { IngredientCategory } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { FilterTagDto } from './filter-tag.dto';

/**
 * Query parameter data transfer object for filtering, searching, sorting, and paginating the ingredient catalog.
 */
export class FilterIngredientDto extends FilterTagDto {
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
