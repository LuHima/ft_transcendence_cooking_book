import { ApiProperty } from '@nestjs/swagger';
import {
  Course,
  RecipeDifficulty,
  TranslationStatus,
} from '@prisma/client';

/**
 * Summary recipe item inside paginated recipe stack.
 */
export class RecipeStackItemDto {
  @ApiProperty({ description: 'Recipe identifier', example: 1 })
  id: number;

  @ApiProperty({ enum: Course, description: 'Course classification', example: Course.first_course })
  course: Course;

  @ApiProperty({ enum: RecipeDifficulty, description: 'Difficulty level', example: RecipeDifficulty.easy })
  difficulty: RecipeDifficulty;

  @ApiProperty({ description: 'Preparation time in minutes', example: 15 })
  prep_time: number;

  @ApiProperty({ description: 'Cooking time in minutes', example: 20 })
  cook_time: number;

  @ApiProperty({ description: 'Total time in minutes', example: 35 })
  total_time: number;

  @ApiProperty({ description: 'Servings yielded', example: 4 })
  servings: number;

  @ApiProperty({ description: 'Author source language code', example: 'it' })
  source_lang: string;

  @ApiProperty({ enum: TranslationStatus, description: 'Translation state', example: TranslationStatus.completed })
  translation_status: TranslationStatus;

  @ApiProperty({ description: 'Cover image URL path', example: '/uploads/recipes/cover.webp', nullable: true })
  cover_image_url: string | null;

  @ApiProperty({ description: 'Tutorial video URL path', example: '/uploads/recipes/video.mp4', nullable: true })
  video_url: string | null;

  @ApiProperty({ description: 'Author username', example: 'mario_rossi', nullable: true })
  username: string | null;

  @ApiProperty({ description: 'Creation date', example: '2026-10-09T18:00:00.000Z' })
  created_at: Date;
}

/**
 * Paginated recipe stack response.
 */
export class RecipePaginationResponseDto {
  /**
   * List of recipes in the current page window.
   */
  @ApiProperty({
    type: [RecipeStackItemDto],
    description: 'Recipes in the requested page window',
  })
  returnPage: RecipeStackItemDto[];

  /**
   * Indicates if another page follows.
   * @example true
   */
  @ApiProperty({ description: 'Indicates if a next page exists', example: true })
  hasNextPage: boolean;

  /**
   * Indicates if a previous page precedes.
   * @example false
   */
  @ApiProperty({ description: 'Indicates if a previous page exists', example: false })
  hasPreviousPage: boolean;
}

/**
 * Cover image upload success response.
 */
export class CoverImageUploadResponseDto {
  /**
   * Relative URL path to the newly saved cover image.
   * @example '/uploads/recipes/recipe_42_cover.webp'
   */
  @ApiProperty({
    description: 'Static URL path to uploaded recipe cover image',
    example: '/uploads/recipes/recipe_42_cover.webp',
  })
  cover_image_url: string;
}

/**
 * Step illustration upload success response.
 */
export class StepImageUploadResponseDto {
  /**
   * Target step number (1-based).
   * @example 2
   */
  @ApiProperty({ description: 'Target 1-based step sequence number', example: 2 })
  step_number: number;

  /**
   * Relative URL path to the newly saved step illustration image.
   * @example '/uploads/recipes/step_2_recipe_42.webp'
   */
  @ApiProperty({
    description: 'Static URL path to uploaded step illustration photo',
    example: '/uploads/recipes/step_2_recipe_42.webp',
  })
  image_url: string;
}

/**
 * Video upload success response.
 */
export class VideoUploadResponseDto {
  /**
   * Relative URL path to the uploaded tutorial video.
   * @example '/uploads/recipes/recipe_42_video.mp4'
   */
  @ApiProperty({
    description: 'Static URL path to uploaded tutorial demonstration video',
    example: '/uploads/recipes/recipe_42_video.mp4',
  })
  video_url: string;
}

/**
 * Recipe like / unlike toggle response.
 */
export class RecipeLikeResponseDto {
  /**
   * Operation outcome message.
   * @example 'Recipe liked successfully'
   */
  @ApiProperty({ description: 'Status message', example: 'Recipe liked successfully' })
  message: string;

  /**
   * Whether the recipe is currently liked by the user.
   * @example true
   */
  @ApiProperty({ description: 'Current like state', example: true })
  liked: boolean;
}

/**
 * Generic recipe operation status message.
 */
export class RecipeMessageResponseDto {
  /**
   * Operation outcome message.
   * @example 'Recipe deleted successfully'
   */
  @ApiProperty({ description: 'Status message', example: 'Recipe deleted successfully' })
  message: string;
}
