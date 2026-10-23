import { ApiPropertyOptional } from '@nestjs/swagger';
import { IngredientCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';

/**
 * Query parameter data transfer object for filtering and searching the ingredient catalog.
 */
export class FilterIngredientDto extends LocaleQueryDto {
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

  /**
   * Case-insensitive substring search across ingredient slugs and translations.
   * @example 'pomodoro'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search across ingredient slugs and translations',
    example: 'pomodoro',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
