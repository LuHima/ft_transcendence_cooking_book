import { ApiProperty } from '@nestjs/swagger';
import { IngredientCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  Matches,
  IsDefined,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TranslationDto } from '../../common/dto/translation.dto';

/**
 * Request body used by admins to add a new ingredient to the curated catalog.
 */
export class CreateIngredientDto {
  /**
   * Unique canonical identifier: lowercase letters, digits and underscores.
   * @example 'bell_pepper'
   */
  @ApiProperty({
    description:
      'Unique canonical slug (lowercase letters, digits, underscores)',
    example: 'bell_pepper',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase snake_case (letters, digits and single underscores, e.g. bell_pepper)',
  })
  slug: string;

  /**
   * Culinary category of the ingredient.
   * @example IngredientCategory.produce
   */
  @ApiProperty({
    enum: IngredientCategory,
    description: 'Ingredient culinary category',
    example: IngredientCategory.produce,
  })
  @IsEnum(IngredientCategory)
  category: IngredientCategory;

  /**
   * Display name in each supported language.
   */
  @ApiProperty({
    type: TranslationDto,
    description: 'Ingredient display name in Italian, English and French',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => TranslationDto)
  translations: TranslationDto;
}
