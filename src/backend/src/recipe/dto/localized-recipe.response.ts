import { ApiProperty } from '@nestjs/swagger';
import {
  Course,
  IngredientCategory,
  MediaType,
  RecipeDifficulty,
  TranslationStatus,
  UnitOfMeasure,
} from '@prisma/client';

/**
 * Localized recipe preparation step.
 */
export class LocalizedRecipeStepResponse {
  /**
   * Unique recipe step record ID.
   * @example 1
   */
  @ApiProperty({ description: 'Recipe step identifier', example: 1 })
  id: number;

  /**
   * Sequence step number (1-based).
   * @example 1
   */
  @ApiProperty({ description: '1-based sequential step order', example: 1 })
  step_number: number;

  /**
   * Localized title of this step, or null if omitted.
   * @example 'Preparare il guanciale'
   */
  @ApiProperty({
    description: 'Localized title of the step',
    example: 'Preparare il guanciale',
    nullable: true,
  })
  title: string | null;

  /**
   * Localized detailed instruction text for this step.
   * @example 'Tagliare il guanciale a listarelle di circa mezzo centimetro di spessore.'
   */
  @ApiProperty({
    description: 'Localized step description instructions',
    example: 'Tagliare il guanciale a listarelle di circa mezzo centimetro di spessore.',
  })
  description: string;

  /**
   * Optional duration in minutes for this step.
   * @example 10
   */
  @ApiProperty({
    description: 'Duration in minutes to complete this step',
    example: 10,
    nullable: true,
  })
  duration: number | null;

  /**
   * URL of the step illustration image, if uploaded.
   * @example '/uploads/recipes/step_1_carbonara.webp'
   */
  @ApiProperty({
    description: 'Static URL path to step illustration photo',
    example: '/uploads/recipes/step_1_carbonara.webp',
    nullable: true,
  })
  image_url: string | null;
}

/**
 * Localized ingredient specification attached to a recipe.
 */
export class LocalizedRecipeIngredientResponse {
  /**
   * Catalog ingredient identifier.
   * @example 5
   */
  @ApiProperty({ description: 'Catalog ingredient ID', example: 5 })
  id: number;

  /**
   * Canonical ingredient slug.
   * @example 'guanciale'
   */
  @ApiProperty({ description: 'Canonical ingredient slug', example: 'guanciale' })
  slug: string;

  /**
   * Ingredient culinary category.
   * @example IngredientCategory.meat
   */
  @ApiProperty({
    enum: IngredientCategory,
    description: 'Ingredient culinary category',
    example: IngredientCategory.meat_poultry,
  })
  category: IngredientCategory;

  /**
   * Localized ingredient name for the requested locale.
   * @example 'Guanciale di Amatrice'
   */
  @ApiProperty({
    description: 'Localized name of the ingredient',
    example: 'Guanciale di Amatrice',
  })
  name: string;

  /**
   * Required quantity in specified units.
   * @example 200
   */
  @ApiProperty({ description: 'Ingredient quantity', example: 200 })
  quantity: number;

  /**
   * Measurement unit.
   * @example UnitOfMeasure.g
   */
  @ApiProperty({
    enum: UnitOfMeasure,
    description: 'Standardized measurement unit',
    example: UnitOfMeasure.g,
  })
  unit: UnitOfMeasure;

  /**
   * Optional localized preparation notes (e.g. cut into strips, freshly grated).
   * @example 'tagliato a listarelle spesse'
   */
  @ApiProperty({
    description: 'Localized preparation notes or cut advice',
    example: 'tagliato a listarelle spesse',
    nullable: true,
  })
  notes: string | null;
}

/**
 * Localized tag attached to a recipe.
 */
export class LocalizedRecipeTagResponse {
  /**
   * Tag identifier.
   * @example 1
   */
  @ApiProperty({ description: 'Tag identifier', example: 1 })
  id: number;

  /**
   * Canonical tag slug.
   * @example 'traditional'
   */
  @ApiProperty({ description: 'Canonical tag slug', example: 'traditional' })
  slug: string;

  /**
   * Localized tag label.
   * @example 'Tradizionale'
   */
  @ApiProperty({ description: 'Localized tag label', example: 'Tradizionale' })
  name: string;
}

/**
 * Media asset attached to a recipe gallery.
 */
export class RecipeMediaResponse {
  /**
   * Unique media record ID.
   * @example 1
   */
  @ApiProperty({ description: 'Media item identifier', example: 1 })
  id: number;

  /**
   * Static asset URL path.
   * @example '/uploads/recipes/gallery_1_carbonara.webp'
   */
  @ApiProperty({
    description: 'Static URL path to media file',
    example: '/uploads/recipes/gallery_1_carbonara.webp',
  })
  url: string;

  /**
   * Media asset type (image or video).
   * @example MediaType.image
   */
  @ApiProperty({
    enum: MediaType,
    description: 'Media format type',
    example: MediaType.image,
  })
  media_type: MediaType;

  /**
   * Display order index (0 to 2 for gallery images).
   * @example 0
   */
  @ApiProperty({ description: 'Display order index', example: 0 })
  order: number;
}

/**
 * Author summary profile attached to recipe responses.
 */
export class RecipeAuthorSummaryDto {
  /**
   * Author user identifier.
   * @example 1
   */
  @ApiProperty({ description: 'Author user identifier', example: 1 })
  id: number;

  /**
   * Author username.
   * @example 'chef_mario'
   */
  @ApiProperty({ description: 'Author username', example: 'chef_mario' })
  username: string;

  /**
   * Author avatar image URL, or null if none uploaded.
   * @example '/uploads/avatars/chef_mario.webp'
   */
  @ApiProperty({
    description: 'Author avatar photo URL',
    example: '/uploads/avatars/chef_mario.webp',
    nullable: true,
  })
  avatar_url: string | null;
}

/**
 * Complete localized recipe detail payload.
 */
export class LocalizedRecipeDetailResponse {
  /**
   * Unique recipe identifier.
   * @example 42
   */
  @ApiProperty({ description: 'Unique recipe identifier', example: 42 })
  id: number;

  /**
   * Course classification in a meal.
   * @example Course.first_course
   */
  @ApiProperty({
    enum: Course,
    description: 'Course classification',
    example: Course.first_course,
  })
  course: Course;

  /**
   * Difficulty level classification.
   * @example RecipeDifficulty.medium
   */
  @ApiProperty({
    enum: RecipeDifficulty,
    description: 'Difficulty level',
    example: RecipeDifficulty.medium,
  })
  difficulty: RecipeDifficulty;

  /**
   * Preparation time in minutes.
   * @example 15
   */
  @ApiProperty({ description: 'Preparation time in minutes', example: 15 })
  prep_time: number;

  /**
   * Cooking time in minutes.
   * @example 10
   */
  @ApiProperty({ description: 'Cooking time in minutes', example: 10 })
  cook_time: number;

  /**
   * Total required time in minutes (prep_time + cook_time).
   * @example 25
   */
  @ApiProperty({ description: 'Total time in minutes (prep_time + cook_time)', example: 25 })
  total_time: number;

  /**
   * Number of servings this recipe yields.
   * @example 4
   */
  @ApiProperty({ description: 'Portions / servings yielded', example: 4 })
  servings: number;

  /**
   * Author canonical compose language code (`it`, `en`, or `fr`).
   * @example 'it'
   */
  @ApiProperty({ description: 'Original author language', example: 'it' })
  source_lang: string;

  /**
   * Automated translation lifecycle status.
   * @example TranslationStatus.completed
   */
  @ApiProperty({
    enum: TranslationStatus,
    description: 'Automated machine translation state',
    example: TranslationStatus.completed,
  })
  translation_status: TranslationStatus;

  /**
   * Main cover image URL path.
   * @example '/uploads/recipes/carbonara_cover.webp'
   */
  @ApiProperty({
    description: 'Primary hero recipe cover image URL',
    example: '/uploads/recipes/carbonara_cover.webp',
    nullable: true,
  })
  cover_image_url: string | null;

  /**
   * Tutorial demonstration video URL path.
   * @example '/uploads/recipes/carbonara_tutorial.mp4'
   */
  @ApiProperty({
    description: 'Tutorial demonstration video URL',
    example: '/uploads/recipes/carbonara_tutorial.mp4',
    nullable: true,
  })
  video_url: string | null;

  /**
   * Recipe creation timestamp.
   * @example '2026-10-09T18:00:00.000Z'
   */
  @ApiProperty({ description: 'Creation timestamp', example: '2026-10-09T18:00:00.000Z' })
  created_at: Date;

  /**
   * Last recipe update timestamp.
   * @example '2026-10-09T18:30:00.000Z'
   */
  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-10-09T18:30:00.000Z',
    nullable: true,
  })
  updated_at: Date | null;

  /**
   * Author public summary.
   */
  @ApiProperty({
    type: RecipeAuthorSummaryDto,
    description: 'Author profile summary',
    nullable: true,
  })
  author: RecipeAuthorSummaryDto | null;

  /**
   * Localized recipe title.
   * @example 'Spaghetti alla Carbonara'
   */
  @ApiProperty({ description: 'Localized recipe title', example: 'Spaghetti alla Carbonara' })
  title: string;

  /**
   * Localized recipe introductory description.
   * @example 'Il grande classico della cucina romana con guanciale, pecorino e tuorli.'
   */
  @ApiProperty({
    description: 'Localized introduction and dish description',
    example: 'Il grande classico della cucina romana con guanciale, pecorino e tuorli.',
  })
  description: string;

  /**
   * Localized preservation and storage advice.
   * @example 'Si consiglia di consumare al momento. Non congelare.'
   */
  @ApiProperty({
    description: 'Localized storage and preservation notes',
    example: 'Si consiglia di consumare al momento. Non congelare.',
    nullable: true,
  })
  preservation: string | null;

  /**
   * Practical advice or culinary tips from the author.
   * @example 'Utilizzare acqua di cottura per emulsionare i tuorli a bagnomaria fuori dal fuoco.'
   */
  @ApiProperty({
    description: 'Author cooking tricks and culinary tips',
    example: 'Utilizzare acqua di cottura per emulsionare i tuorli fuori dal fuoco.',
    nullable: true,
  })
  tips: string | null;

  /**
   * Ordered list of localized instruction steps.
   */
  @ApiProperty({
    type: [LocalizedRecipeStepResponse],
    description: 'Ordered sequence of recipe preparation steps',
  })
  steps: LocalizedRecipeStepResponse[];

  /**
   * List of localized recipe ingredients.
   */
  @ApiProperty({
    type: [LocalizedRecipeIngredientResponse],
    description: 'List of ingredients with quantities and localized notes',
  })
  ingredients: LocalizedRecipeIngredientResponse[];

  /**
   * List of localized dietary and culinary tags.
   */
  @ApiProperty({
    type: [LocalizedRecipeTagResponse],
    description: 'Classification tags attached to the recipe',
  })
  tags: LocalizedRecipeTagResponse[];

  /**
   * Supplementary photos in the recipe gallery (up to 3 items).
   */
  @ApiProperty({
    type: [RecipeMediaResponse],
    description: 'Supplementary gallery plating photos',
  })
  media: RecipeMediaResponse[];
}
