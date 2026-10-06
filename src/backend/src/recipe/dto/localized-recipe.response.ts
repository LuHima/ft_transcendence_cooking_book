import {
  Course,
  IngredientCategory,
  MediaType,
  RecipeDifficulty,
  TranslationStatus,
  UnitOfMeasure,
} from '@prisma/client';

export interface LocalizedRecipeStepResponse {
  id: number;
  step_number: number;
  title: string | null;
  description: string;
  duration: number | null;
  image_url: string | null;
}

export interface LocalizedRecipeIngredientResponse {
  id: number; // ingredient catalog ID
  slug: string;
  category: IngredientCategory;
  name: string; // localized ingredient name
  quantity: number;
  unit: UnitOfMeasure;
  notes: string | null; // localized note
}

export interface LocalizedRecipeTagResponse {
  id: number;
  slug: string;
  name: string; // localized tag label
}

export interface RecipeMediaResponse {
  id: number;
  url: string;
  media_type: MediaType;
  order: number;
}

export interface LocalizedRecipeDetailResponse {
  id: number;
  course: Course;
  difficulty: RecipeDifficulty;
  prep_time: number;
  cook_time: number;
  total_time: number;
  servings: number;
  source_lang: string;
  translation_status: TranslationStatus;
  cover_image_url: string | null;
  video_url: string | null;
  created_at: Date;
  updated_at: Date | null;
  author: {
    id: number;
    username: string;
    avatar_url: string | null;
  } | null;
  title: string;
  description: string;
  preservation: string | null;
  tips: string | null;
  steps: LocalizedRecipeStepResponse[];
  ingredients: LocalizedRecipeIngredientResponse[];
  tags: LocalizedRecipeTagResponse[];
  media: RecipeMediaResponse[];
}
