import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Course, RecipeDifficulty, UnitOfMeasure } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Data transfer object for adding an individual instruction step during recipe creation.
 */
export class CreateRecipeStepDto {
  /**
   * 1-based sequential step order number.
   * @example 1
   */
  @ApiProperty({
    description: '1-based sequential step order number',
    minimum: 1,
    example: 1,
  })
  @IsInt()
  @Min(1)
  step_number: number;

  /**
   * Optional step title.
   * @example 'Preparare il guanciale'
   */
  @ApiPropertyOptional({
    description: 'Optional summary title for this step',
    maxLength: 255,
    example: 'Preparare il guanciale',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  /**
   * Detailed instruction instructions for this step.
   * @example 'Tagliare il guanciale a striscioline spesse mezzo centimetro.'
   */
  @ApiProperty({
    description: 'Detailed instructions for this step in source_lang',
    example: 'Tagliare il guanciale a striscioline spesse mezzo centimetro.',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  /**
   * Optional step execution duration in minutes.
   * @example 10
   */
  @ApiPropertyOptional({
    description: 'Step duration in minutes',
    minimum: 0,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}

/**
 * Data transfer object linking a catalog ingredient with quantity and measurement unit to a recipe.
 */
export class CreateRecipeIngredientDto {
  /**
   * Catalog ingredient ID.
   * @example 5
   */
  @ApiProperty({
    description: 'Catalog ingredient ID referenced from /api/ingredients',
    example: 5,
  })
  @IsInt()
  ingredient_id: number;

  /**
   * Required quantity in the specified unit.
   * @example 200
   */
  @ApiProperty({
    description: 'Ingredient quantity (greater than or equal to 0)',
    minimum: 0,
    example: 200,
  })
  @IsNumber()
  @Min(0)
  quantity: number;

  /**
   * Standardized measurement unit.
   * @example UnitOfMeasure.grams
   */
  @ApiProperty({
    enum: UnitOfMeasure,
    description: 'Unit of measure (e.g. g, ml, piece)',
    example: UnitOfMeasure.g,
  })
  @IsEnum(UnitOfMeasure)
  unit: UnitOfMeasure;

  /**
   * Optional localized preparation notes (single string or language dictionary).
   * @example 'tagliato a listarelle'
   */
  @ApiPropertyOptional({
    description: 'Optional preparation notes as a string or key-value locale dictionary',
    example: 'tagliato a listarelle',
  })
  @IsOptional()
  notes?: Record<string, string> | string;
}

/**
 * Data transfer object for creating a new recipe with steps, ingredients, and optional tags.
 */
export class CreateRecipeDto {
  /**
   * Title of the recipe.
   * @example 'Spaghetti alla Carbonara'
   */
  @ApiProperty({
    description: 'Recipe title in source_lang (3-255 characters)',
    minLength: 3,
    maxLength: 255,
    example: 'Spaghetti alla Carbonara',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;

  /**
   * Introductory description of the dish.
   * @example 'Il grande classico della cucina tradizionale romana preparato con guanciale e pecorino.'
   */
  @ApiProperty({
    description: 'Introductory recipe description in source_lang (min 10 characters)',
    minLength: 10,
    example: 'Il grande classico della cucina tradizionale romana preparato con guanciale e pecorino.',
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  description: string;

  /**
   * Storage and preservation advice.
   * @example 'Consumare immediatamente; non congelare.'
   */
  @ApiPropertyOptional({
    description: 'Storage and shelf life advice',
    example: 'Consumare immediatamente; non congelare.',
  })
  @IsOptional()
  @IsString()
  preservation?: string;

  /**
   * Culinary secrets, suggestions, or substitution tips from the author.
   * @example 'Mantecare a bagnomaria per evitare che le uova coagulino a frittata.'
   */
  @ApiPropertyOptional({
    description: 'Author tips, tricks, and culinary secrets',
    example: 'Mantecare a bagnomaria per evitare che le uova coagulino a frittata.',
  })
  @IsOptional()
  @IsString()
  tips?: string;

  /**
   * Course classification in a meal.
   * @example Course.first_course
   */
  @ApiProperty({
    enum: Course,
    description: 'Course classification within a meal',
    example: Course.first_course,
  })
  @IsEnum(Course)
  course: Course;

  /**
   * Difficulty level classification.
   * @example RecipeDifficulty.medium
   */
  @ApiProperty({
    enum: RecipeDifficulty,
    description: 'Difficulty rating',
    example: RecipeDifficulty.medium,
  })
  @IsEnum(RecipeDifficulty)
  difficulty: RecipeDifficulty;

  /**
   * Active preparation time in minutes.
   * @example 15
   */
  @ApiProperty({
    description: 'Preparation time in minutes',
    minimum: 0,
    example: 15,
  })
  @IsInt()
  @Min(0)
  prep_time: number;

  /**
   * Cooking time in minutes.
   * @example 10
   */
  @ApiProperty({
    description: 'Cooking time in minutes',
    minimum: 0,
    example: 10,
  })
  @IsInt()
  @Min(0)
  cook_time: number;

  /**
   * Number of servings this recipe yields.
   * @example 4
   */
  @ApiProperty({
    description: 'Yield in servings/portions (minimum 1)',
    minimum: 1,
    example: 4,
  })
  @IsInt()
  @Min(1)
  servings: number;

  /**
   * Source language in which the recipe was originally written.
   * @example 'it'
   */
  @ApiProperty({
    enum: ['it', 'en', 'fr'],
    description: 'Author canonical writing language code (it, en, fr)',
    example: 'it',
  })
  @IsString()
  @IsIn(['it', 'en', 'fr'], { message: 'source_lang must be it, en, or fr' })
  source_lang: string;

  /**
   * Ordered sequence of preparation steps (at least one required).
   */
  @ApiProperty({
    type: [CreateRecipeStepDto],
    description: 'Ordered sequence of recipe preparation steps (minimum 1 step)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Recipe must have at least one step' })
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeStepDto)
  steps: CreateRecipeStepDto[];

  /**
   * List of recipe ingredients with quantities and units (at least one required).
   */
  @ApiProperty({
    type: [CreateRecipeIngredientDto],
    description: 'List of ingredients with quantities and units (minimum 1 ingredient)',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Recipe must have at least one ingredient' })
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients: CreateRecipeIngredientDto[];

  /**
   * Optional catalog tag IDs to classify the recipe.
   * @example [1, 3]
   */
  @ApiPropertyOptional({
    type: [Number],
    description: 'Optional catalog tag IDs to attach (e.g. dietary or style tags)',
    example: [1, 3],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tag_ids?: number[];
}