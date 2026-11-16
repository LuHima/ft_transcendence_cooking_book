import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Course,
  RecipeDifficulty,
  RecipePrivacy,
  UnitOfMeasure,
} from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { trimString, trimToNull } from '../../common/dto/string-transforms';
import {
  IsIngredientNotes,
  normalizeIngredientNotes,
} from '../../common/validators/recipe-ingredient-notes.validator';
import {
  INT32_MAX,
  MAX_INGREDIENT_NOTES_LENGTH,
  MAX_INGREDIENT_QUANTITY,
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_TAGS,
  MAX_RECIPE_TIME_MINUTES,
  MAX_SERVINGS,
  MAX_STEP_NUMBER,
  MIN_INGREDIENT_QUANTITY,
  SUPPORTED_LOCALES,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

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
    maximum: MAX_STEP_NUMBER,
    example: 1,
  })
  @IsInt({ message: 'Step number must be a whole number' })
  @Min(1, { message: 'Step number must be at least 1' })
  @Max(MAX_STEP_NUMBER, {
    message: `Step number cannot exceed ${MAX_STEP_NUMBER}`,
  })
  step_number: number;

  /**
   * Optional step title.
   * @example 'Preparare il guanciale'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Optional summary title for this step (max 255 characters; empty resolves to null)',
    maxLength: 255,
    example: 'Preparare il guanciale',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Step title must be a text string' })
  @MaxLength(255, { message: 'Step title cannot exceed 255 characters' })
  title?: string | null;

  /**
   * Detailed instruction instructions for this step.
   * @example 'Tagliare il guanciale a striscioline spesse mezzo centimetro.'
   */
  @ApiProperty({
    description: 'Detailed instructions for this step in source_lang',
    maxLength: 2000,
    example: 'Tagliare il guanciale a striscioline spesse mezzo centimetro.',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Recipe step details cannot be empty' })
  @IsString({ message: 'Recipe step details must be a text string' })
  @MaxLength(2000, {
    message: 'Recipe step details cannot exceed 2000 characters',
  })
  description: string;

  /**
   * Optional step execution duration in minutes.
   * @example 10
   */
  @ApiPropertyOptional({
    description: 'Step duration in minutes (0 to 8760)',
    minimum: 0,
    maximum: MAX_RECIPE_TIME_MINUTES,
    example: 10,
  })
  @IsOptional()
  @IsInt({ message: 'Step duration must be a whole number of minutes' })
  @Min(0, { message: 'Step duration cannot be negative' })
  @Max(MAX_RECIPE_TIME_MINUTES, {
    message: `Step duration cannot exceed ${MAX_RECIPE_TIME_MINUTES} minutes`,
  })
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
    minimum: 1,
    maximum: INT32_MAX,
    example: 5,
  })
  @IsInt({ message: 'Ingredient ID must be a whole number' })
  @Min(1, { message: VALIDATION_MESSAGES.idRange })
  @Max(INT32_MAX, { message: VALIDATION_MESSAGES.idRange })
  ingredient_id: number;

  /**
   * Required quantity in the specified unit.
   * @example 200
   */
  @ApiProperty({
    description: 'Ingredient quantity (0.01 to 99999999.99)',
    minimum: MIN_INGREDIENT_QUANTITY,
    maximum: MAX_INGREDIENT_QUANTITY,
    example: 200,
  })
  @IsNumber({}, { message: 'Ingredient quantity must be a valid number' })
  @Min(MIN_INGREDIENT_QUANTITY, {
    message: `Ingredient quantity must be at least ${MIN_INGREDIENT_QUANTITY}`,
  })
  @Max(MAX_INGREDIENT_QUANTITY, {
    message: `Ingredient quantity cannot exceed ${MAX_INGREDIENT_QUANTITY}`,
  })
  quantity: number;

  /**
   * Standardized measurement unit.
   * @example UnitOfMeasure.g
   */
  @ApiProperty({
    enum: UnitOfMeasure,
    description: 'Unit of measure (e.g. g, ml, piece)',
    example: UnitOfMeasure.g,
  })
  @IsEnum(UnitOfMeasure, { message: 'Invalid unit of measure' })
  unit: UnitOfMeasure;

  /**
   * Optional localized preparation notes (single string or language dictionary).
   * @example 'tagliato a listarelle'
   */
  @ApiPropertyOptional({
    description:
      'Optional preparation notes as a string or key-value locale dictionary (it, en, fr; max 255 chars)',
    nullable: true,
    oneOf: [
      { type: 'string', maxLength: MAX_INGREDIENT_NOTES_LENGTH },
      {
        type: 'object',
        properties: {
          it: { type: 'string', maxLength: MAX_INGREDIENT_NOTES_LENGTH },
          en: { type: 'string', maxLength: MAX_INGREDIENT_NOTES_LENGTH },
          fr: { type: 'string', maxLength: MAX_INGREDIENT_NOTES_LENGTH },
        },
        additionalProperties: false,
      },
    ],
    example: 'tagliato a listarelle',
  })
  @IsOptional()
  @Transform(normalizeIngredientNotes)
  @IsIngredientNotes()
  notes?: Record<string, string> | string | null;
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
  @Transform(trimString)
  @IsNotEmpty({ message: 'Title cannot be empty' })
  @IsString({ message: 'Title must be a text string' })
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;

  /**
   * Introductory description of the dish.
   * @example 'Il grande classico della cucina tradizionale romana preparato con guanciale e pecorino.'
   */
  @ApiProperty({
    description:
      'Introductory recipe description in source_lang (10-1000 characters)',
    minLength: 10,
    maxLength: 1000,
    example:
      'Il grande classico della cucina tradizionale romana preparato con guanciale e pecorino.',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Description cannot be empty' })
  @IsString({ message: 'Description must be a text string' })
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description: string;

  /**
   * Storage and preservation advice.
   * @example 'Consumare immediatamente; non congelare.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Storage and shelf life advice (max 1000 characters; empty resolves to null)',
    maxLength: 1000,
    example: 'Consumare immediatamente; non congelare.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Preservation notes must be a text string' })
  @MaxLength(1000, {
    message: 'Preservation notes cannot exceed 1000 characters',
  })
  preservation?: string | null;

  /**
   * Culinary secrets, suggestions, or substitution tips from the author.
   * @example 'Mantecare a bagnomaria per evitare che le uova coagulino a frittata.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Author tips, tricks, and culinary secrets (max 1000 characters; empty resolves to null)',
    maxLength: 1000,
    example:
      'Mantecare a bagnomaria per evitare che le uova coagulino a frittata.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Tips must be a text string' })
  @MaxLength(1000, { message: 'Tips cannot exceed 1000 characters' })
  tips?: string | null;

  /**
   * Course classification in a meal.
   * @example Course.first_course
   */
  @ApiProperty({
    enum: Course,
    description:
      'Course classification within a meal (first course, main course, dessert, etc.)',
    example: Course.first_course,
  })
  @IsEnum(Course, { message: 'Invalid course category' })
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
  @IsEnum(RecipeDifficulty, { message: 'Invalid difficulty level' })
  difficulty: RecipeDifficulty;

  /**
   * Active preparation time in minutes.
   * @example 15
   */
  @ApiProperty({
    description: 'Preparation time in minutes (0 to 8760)',
    minimum: 0,
    maximum: MAX_RECIPE_TIME_MINUTES,
    example: 15,
  })
  @IsInt({ message: 'Preparation time must be a whole number of minutes' })
  @Min(0, { message: 'Preparation time cannot be negative' })
  @Max(MAX_RECIPE_TIME_MINUTES, {
    message: `Preparation time cannot exceed ${MAX_RECIPE_TIME_MINUTES} minutes`,
  })
  prep_time: number;

  /**
   * Cooking time in minutes.
   * @example 10
   */
  @ApiProperty({
    description: 'Cooking time in minutes (0 to 8760)',
    minimum: 0,
    maximum: MAX_RECIPE_TIME_MINUTES,
    example: 10,
  })
  @IsInt({ message: 'Cooking time must be a whole number of minutes' })
  @Min(0, { message: 'Cooking time cannot be negative' })
  @Max(MAX_RECIPE_TIME_MINUTES, {
    message: `Cooking time cannot exceed ${MAX_RECIPE_TIME_MINUTES} minutes`,
  })
  cook_time: number;

  /**
   * Number of servings this recipe yields.
   * @example 4
   */
  @ApiProperty({
    description: 'Yield in servings/portions (1 to 1000)',
    minimum: 1,
    maximum: MAX_SERVINGS,
    example: 4,
  })
  @IsInt({ message: 'Servings must be a whole number' })
  @Min(1, { message: 'Servings must be at least 1' })
  @Max(MAX_SERVINGS, { message: `Servings cannot exceed ${MAX_SERVINGS}` })
  servings: number;

  /**
   * Source language in which the recipe was originally written.
   * @example 'it'
   */
  @ApiProperty({
    enum: SUPPORTED_LOCALES,
    description: 'Author canonical writing language code (it, en, fr)',
    example: 'it',
  })
  @IsString({ message: 'source_lang must be a text string' })
  @IsIn(SUPPORTED_LOCALES, { message: 'source_lang must be it, en, or fr' })
  source_lang: string;

  /**
   * Optional privacy tier for recipe visibility. Defaults to public.
   * @example RecipePrivacy.public
   */
  @ApiPropertyOptional({
    enum: RecipePrivacy,
    description: 'Privacy tier of the recipe (public, friends_only, private)',
    example: RecipePrivacy.public,
  })
  @IsOptional()
  @IsEnum(RecipePrivacy, {
    message: 'Privacy must be one of: public, friends_only, private',
  })
  privacy?: RecipePrivacy;

  /**
   * Ordered sequence of preparation steps (at least one required).
   */
  @ApiProperty({
    type: [CreateRecipeStepDto],
    description: 'Ordered sequence of recipe preparation steps (1 to 50 steps)',
  })
  @IsArray({ message: 'Steps must be an array' })
  @ArrayMinSize(1, { message: 'Recipe must have at least one step' })
  @ArrayMaxSize(MAX_RECIPE_STEPS, {
    message: `Recipe cannot have more than ${MAX_RECIPE_STEPS} steps`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeStepDto)
  steps: CreateRecipeStepDto[];

  /**
   * List of recipe ingredients with quantities and units (at least one required).
   */
  @ApiProperty({
    type: [CreateRecipeIngredientDto],
    description:
      'List of ingredients with quantities and units (1 to 100 ingredients)',
  })
  @IsArray({ message: 'Ingredients must be an array' })
  @ArrayMinSize(1, { message: 'Recipe must have at least one ingredient' })
  @ArrayMaxSize(MAX_RECIPE_INGREDIENTS, {
    message: `Recipe cannot have more than ${MAX_RECIPE_INGREDIENTS} ingredients`,
  })
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients: CreateRecipeIngredientDto[];

  /**
   * Optional catalog tag IDs to classify the recipe.
   * @example [1, 3]
   */
  @ApiPropertyOptional({
    type: [Number],
    description:
      'Optional catalog tag IDs to attach (e.g. dietary or style tags; max 30).',
    example: [1, 3],
  })
  @IsOptional()
  @IsArray({ message: 'tag_ids must be an array of integers' })
  @ArrayMaxSize(MAX_RECIPE_TAGS, {
    message: `Recipe cannot have more than ${MAX_RECIPE_TAGS} tags`,
  })
  @IsInt({ each: true, message: VALIDATION_MESSAGES.idRange })
  @Min(1, { each: true, message: VALIDATION_MESSAGES.idRange })
  @Max(INT32_MAX, { each: true, message: VALIDATION_MESSAGES.idRange })
  tag_ids?: number[];
}
