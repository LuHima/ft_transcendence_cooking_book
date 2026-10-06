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

export class CreateRecipeStepDto {
  @IsInt()
  @Min(1)
  step_number: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration?: number;
}

export class CreateRecipeIngredientDto {
  @IsInt()
  ingredient_id: number;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsEnum(UnitOfMeasure)
  unit: UnitOfMeasure;

  @IsOptional()
  notes?: Record<string, string> | string;
  /*
  The notes field could be a simple sentence (string) in one language,
  or a key-value dictionary (Record<string, string>) like this:
  {
    "it": "tagliato a listarelle",
    "en": "cut into strips",
    "fr": "coupé en lanières"
  }
  */
}

export class CreateRecipeDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters long' })
  @MaxLength(255, { message: 'Title cannot exceed 255 characters' })
  title: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  description: string;

  @IsOptional()
  @IsString()
  preservation?: string;

  @IsOptional()
  @IsString()
  tips?: string;

  @IsEnum(Course)
  course: Course;

  @IsEnum(RecipeDifficulty)
  difficulty: RecipeDifficulty;

  @IsInt()
  @Min(0)
  prep_time: number;

  @IsInt()
  @Min(0)
  cook_time: number;

  @IsInt()
  @Min(1)
  servings: number;

  @IsString()
  @IsIn(['it', 'en', 'fr'], { message: 'source_lang must be it, en, or fr' })
  source_lang: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Recipe must have at least one step' })
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeStepDto)
  steps: CreateRecipeStepDto[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Recipe must have at least one ingredient' })
  @ValidateNested({ each: true })
  @Type(() => CreateRecipeIngredientDto)
  ingredients: CreateRecipeIngredientDto[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tag_ids?: number[];
}