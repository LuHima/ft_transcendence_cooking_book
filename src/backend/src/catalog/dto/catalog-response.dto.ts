import { ApiProperty } from '@nestjs/swagger';
import {
  Course,
  RecipeDifficulty,
  UnitOfMeasure,
  IngredientCategory,
} from '@prisma/client';

/**
 * Static metadata dictionaries providing all system enumeration values.
 */
export class CatalogMetadataResponseDto {
  /**
   * Available meal courses.
   */
  @ApiProperty({
    enum: Course,
    isArray: true,
    description: 'List of meal courses (e.g. appetizer, first_course, dessert)',
    example: Object.values(Course),
  })
  courses: Course[];

  /**
   * Available recipe difficulty levels.
   */
  @ApiProperty({
    enum: RecipeDifficulty,
    isArray: true,
    description:
      'List of recipe difficulty classifications (very_easy, easy, medium, hard, very_hard)',
    example: Object.values(RecipeDifficulty),
  })
  difficulties: RecipeDifficulty[];

  /**
   * Supported units of measure across Metric and US Customary systems.
   */
  @ApiProperty({
    enum: UnitOfMeasure,
    isArray: true,
    description:
      'Supported measurement units (grams, milliliters, spoons, pieces, etc.)',
    example: Object.values(UnitOfMeasure),
  })
  units: UnitOfMeasure[];

  /**
   * Standard food and culinary ingredient categories.
   */
  @ApiProperty({
    enum: IngredientCategory,
    isArray: true,
    description:
      'Ingredient culinary categories (vegetables, dairy, meat, spices, etc.)',
    example: Object.values(IngredientCategory),
  })
  categories: IngredientCategory[];
}

/**
 * Curated culinary or dietary tag item.
 */
export class TagResponseDto {
  /**
   * Unique tag identifier.
   * @example 1
   */
  @ApiProperty({ description: 'Unique tag identifier', example: 1 })
  id: number;

  /**
   * Canonical slug identifier.
   * @example 'vegetarian'
   */
  @ApiProperty({ description: 'Canonical tag slug', example: 'vegetarian' })
  slug: string;

  /**
   * Localized tag display name.
   * @example 'Vegetariano'
   */
  @ApiProperty({
    description: 'Localized tag display name',
    example: 'Vegetariano',
  })
  name: string;
}

/**
 * Curated ingredient catalog item.
 */
export class IngredientResponseDto {
  /**
   * Unique ingredient catalog identifier.
   * @example 12
   */
  @ApiProperty({
    description: 'Unique ingredient catalog identifier',
    example: 12,
  })
  id: number;

  /**
   * Canonical slug identifier.
   * @example 'parmigiano-reggiano'
   */
  @ApiProperty({
    description: 'Canonical ingredient slug',
    example: 'parmigiano-reggiano',
  })
  slug: string;

  /**
   * Ingredient food category.
   * @example IngredientCategory.dairy
   */
  @ApiProperty({
    enum: IngredientCategory,
    description: 'Ingredient culinary category',
    example: IngredientCategory.dairy_eggs,
  })
  category: IngredientCategory;

  /**
   * Localized ingredient display name.
   * @example 'Parmigiano Reggiano DOP'
   */
  @ApiProperty({
    description: 'Localized ingredient display name',
    example: 'Parmigiano Reggiano DOP',
  })
  name: string;
}
