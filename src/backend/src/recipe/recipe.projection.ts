import { Injectable } from '@nestjs/common';
import { OwnerType, TranslationSource } from '@prisma/client';
import {
  LocalizedRecipeDetailResponse,
  LocalizedRecipeIngredientResponse,
  LocalizedRecipeStepResponse,
  LocalizedRecipeSummaryResponse,
  LocalizedRecipeTagResponse,
  RecipeMediaResponse,
} from './dto/localized-recipe.response';
import { PaginatedRecipeResponseDto } from './dto/recipe-response.dto';

export const RECIPE_SUMMARY_INCLUDE = (currentUserId?: number) => ({
  translations: true,
  user: {
    select: {
      id: true,
      username: true,
      avatar_url: true,
    },
  },
  recipe_tags: {
    include: {
      tag: {
        include: {
          translations: true,
        },
      },
    },
  },
  _count: {
    select: {
      likes: true,
      comments: {
        where: { is_active: true },
      },
    },
  },
  likes: currentUserId
    ? {
        where: { user_id: currentUserId },
        select: { user_id: true },
      }
    : false,
});

export const RECIPE_DETAIL_INCLUDE = (currentUserId?: number) => ({
  translations: true,
  steps: {
    include: {
      translations: true,
    },
    orderBy: {
      step_number: 'asc' as const,
    },
  },
  recipe_ingredients: {
    include: {
      ingredient: {
        include: {
          translations: true,
        },
      },
    },
  },
  recipe_tags: {
    include: {
      tag: {
        include: {
          translations: true,
        },
      },
    },
  },
  recipe_media: {
    orderBy: {
      order: 'asc' as const,
    },
  },
  user: {
    select: {
      id: true,
      username: true,
      avatar_url: true,
    },
  },
  _count: {
    select: {
      likes: true,
      comments: {
        where: { is_active: true },
      },
    },
  },
  likes: currentUserId
    ? {
        where: { user_id: currentUserId },
        select: { user_id: true },
      }
    : false,
});

@Injectable()
export class RecipeProjection {
  /**
   * Normalizes requested locale to supported set ('it', 'en', 'fr') or defaults to source_lang or 'en'.
   */
  resolveLocale(lang?: string, sourceLang?: string): string {
    if (lang === 'it' || lang === 'en' || lang === 'fr') {
      return lang;
    }
    return sourceLang || 'en';
  }

  /**
   * Executes four-tier cascade: targetLocale -> source_lang -> 'en' -> translations[0].
   */
  resolveTranslation<T extends { locale: string } = any>(
    translations: T[],
    targetLocale: string,
    sourceLang: string,
  ): T {
    if (!translations || translations.length === 0) {
      return undefined as unknown as T;
    }
    return (
      translations.find((t) => t.locale === targetLocale) ??
      translations.find((t) => t.locale === sourceLang) ??
      translations.find((t) => t.locale === 'en') ??
      translations[0]
    );
  }

  /**
   * Maps recipe tags with localized name fallback (targetLocale -> source_lang -> 'en' -> slug) and resolved language.
   */
  resolveTagTranslations(
    recipeTags: any[],
    targetLocale: string,
    sourceLang: string,
  ): LocalizedRecipeTagResponse[] {
    return (recipeTags ?? []).map((rt: any) => {
      const t = rt.tag ?? rt;
      const tagTrans =
        t?.translations?.find((tr: any) => tr.locale === targetLocale) ??
        t?.translations?.find((tr: any) => tr.locale === sourceLang) ??
        t?.translations?.find((tr: any) => tr.locale === 'en');
      return {
        id: t?.id ?? 0,
        slug: t?.slug ?? '',
        name: tagTrans?.name ?? t?.slug ?? '',
        resolved_lang: tagTrans?.locale ?? 'en',
      };
    });
  }

  /**
   * Extracts notes from JSON dictionary or string with graceful locale fallback.
   */
  resolveIngredientNotes(
    notes: any,
    targetLocale: string,
    sourceLang: string,
  ): string | null {
    if (!notes) {
      return null;
    }
    if (typeof notes === 'object' && !Array.isArray(notes)) {
      const notesObj = notes as Record<string, string>;
      return (
        notesObj[targetLocale] ?? notesObj[sourceLang] ?? notesObj['en'] ?? null
      );
    }
    if (typeof notes === 'string') {
      return notes;
    }
    return null;
  }

  /**
   * Maps a raw recipe record to a lightweight summary card DTO.
   */
  toLocalizedSummary(
    recipe: any,
    lang?: string,
    currentUserId?: number,
  ): LocalizedRecipeSummaryResponse {
    const targetLocale = this.resolveLocale(lang, recipe.source_lang);
    const translation: any = this.resolveTranslation(
      recipe.translations ?? [],
      targetLocale,
      recipe.source_lang,
    );
    const resolved_lang = translation?.locale ?? (recipe.source_lang || 'en');
    const tags = this.resolveTagTranslations(
      recipe.recipe_tags ?? [],
      targetLocale,
      recipe.source_lang,
    );

    const is_liked =
      recipe.is_liked !== undefined
        ? Boolean(recipe.is_liked)
        : currentUserId
          ? Boolean(
              recipe.likes &&
              recipe.likes.length > 0 &&
              recipe.likes.some(
                (l: any) =>
                  l.user_id === undefined || l.user_id === currentUserId,
              ),
            )
          : false;

    return {
      id: recipe.id,
      is_active: recipe.is_active ?? true,
      course: recipe.course,
      difficulty: recipe.difficulty,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      total_time: recipe.total_time,
      servings: recipe.servings,
      source_lang: recipe.source_lang,
      translation_status: recipe.translation_status,
      cover_image_url: recipe.cover_image_url ?? null,
      video_url: recipe.video_url ?? null,
      created_at: recipe.created_at,
      updated_at: recipe.updated_at ?? null,
      author:
        recipe.owner_type === OwnerType.platform || !recipe.user
          ? null
          : {
              id: recipe.user.id,
              username: recipe.user.username,
              avatar_url: recipe.user.avatar_url ?? null,
            },
      title: translation?.title ?? '',
      description: translation?.description ?? '',
      tags,
      likes_count: recipe._count?.likes ?? 0,
      comments_count: recipe._count?.comments ?? 0,
      is_liked,
      resolved_lang,
      available_languages: (recipe.translations ?? []).map(
        (t: any) => t.locale,
      ),
    };
  }

  /**
   * Maps an array of recipes and builds the bounded pagination envelope.
   */
  toPaginatedSummaryResponse(
    recipes: any[],
    total: number,
    query?: { page?: number; limit?: number; lang?: string },
    currentUserId?: number,
  ): PaginatedRecipeResponseDto {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const items = (recipes ?? []).map((recipe) =>
      this.toLocalizedSummary(recipe, query?.lang, currentUserId),
    );
    const total_pages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    };
  }

  /**
   * Maps full recipe entity with steps, ingredients, notes, and media.
   */
  toLocalizedDetail(
    recipe: any,
    lang?: string,
    currentUserId?: number,
  ): LocalizedRecipeDetailResponse {
    const targetLocale = this.resolveLocale(lang, recipe.source_lang);
    const translation: any = this.resolveTranslation(
      recipe.translations ?? [],
      targetLocale,
      recipe.source_lang,
    );
    const resolved_lang = translation?.locale ?? (recipe.source_lang || 'en');
    const tags = this.resolveTagTranslations(
      recipe.recipe_tags ?? [],
      targetLocale,
      recipe.source_lang,
    );

    const sortedSteps = [...(recipe.steps ?? [])].sort(
      (a, b) => a.step_number - b.step_number,
    );

    const steps: LocalizedRecipeStepResponse[] = sortedSteps.map((s: any) => {
      const stepTrans: any = this.resolveTranslation(
        s.translations ?? [],
        targetLocale,
        recipe.source_lang,
      );
      return {
        id: s.id,
        step_number: s.step_number,
        title: stepTrans?.title ?? null,
        description: stepTrans?.description ?? '',
        duration: s.duration ?? null,
        image_url: s.image_url ?? null,
      };
    });

    const ingredients: LocalizedRecipeIngredientResponse[] = (
      recipe.recipe_ingredients ?? []
    ).map((ri: any) => {
      const ing = ri.ingredient ?? ri;
      const ingTrans: any = this.resolveTranslation(
        ing.translations ?? [],
        targetLocale,
        recipe.source_lang,
      );
      const note = this.resolveIngredientNotes(
        ri.notes,
        targetLocale,
        recipe.source_lang,
      );
      return {
        id: ing.id,
        slug: ing.slug,
        category: ing.category,
        name: ingTrans?.name ?? ing.slug,
        quantity: Number(ri.quantity),
        unit: ri.unit,
        notes: note,
        resolved_lang: ingTrans?.locale ?? 'en',
      };
    });

    const media: RecipeMediaResponse[] = (recipe.recipe_media ?? []).map(
      (m: any) => ({
        id: m.id,
        url: m.url,
        media_type: m.media_type,
        order: m.order,
      }),
    );

    const is_liked =
      recipe.is_liked !== undefined
        ? Boolean(recipe.is_liked)
        : currentUserId
          ? Boolean(
              recipe.likes &&
              recipe.likes.length > 0 &&
              recipe.likes.some(
                (l: any) =>
                  l.user_id === undefined || l.user_id === currentUserId,
              ),
            )
          : false;

    return {
      id: recipe.id,
      is_active: recipe.is_active ?? true,
      course: recipe.course,
      difficulty: recipe.difficulty,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      total_time: recipe.total_time,
      servings: recipe.servings,
      source_lang: recipe.source_lang,
      translation_status: recipe.translation_status,
      cover_image_url: recipe.cover_image_url ?? null,
      video_url: recipe.video_url ?? null,
      created_at: recipe.created_at,
      updated_at: recipe.updated_at ?? null,
      author:
        recipe.owner_type === OwnerType.platform || !recipe.user
          ? null
          : {
              id: recipe.user.id,
              username: recipe.user.username,
              avatar_url: recipe.user.avatar_url ?? null,
            },
      title: translation?.title ?? '',
      description: translation?.description ?? '',
      preservation: translation?.preservation ?? null,
      tips: translation?.tips ?? null,
      translation_source:
        translation?.translation_source ?? TranslationSource.machine,
      steps,
      ingredients,
      tags,
      media,
      likes_count: recipe._count?.likes ?? 0,
      comments_count: recipe._count?.comments ?? 0,
      is_liked,
      resolved_lang,
      available_languages: (recipe.translations ?? []).map((t: any) => ({
        locale: t.locale,
        translation_source: t.translation_source ?? TranslationSource.machine,
      })),
    };
  }
}
