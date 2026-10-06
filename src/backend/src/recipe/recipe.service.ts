import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import { OwnerType, TranslationStatus } from '@prisma/client';
import type { Prisma, Recipe } from '@prisma/client';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import {
  LocalizedRecipeStepResponse,
  LocalizedRecipeIngredientResponse,
  LocalizedRecipeTagResponse,
  RecipeMediaResponse,
  LocalizedRecipeDetailResponse,
} from './dto/localized-recipe.response';

@Injectable()
export class RecipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translationService: TranslationService,
  ) {}

  public async getAllRecipe(who?: 'user' | 'id') {
    // ! who e' solo per testare
    if (who) {
      return 'hello';
    }
    return await this.prisma.recipe.findMany({
      include: {
        translations: true,
      },
    });
  }

  public async getRecipeStack(page: number) {
    let limit: number = 30;

    if (!page || page < 1) {
      throw new BadRequestException('Page number must be greater than 0');
    }
    let recipes = await this.prisma.recipe.findMany({
      skip: (page - 1) * limit,
      take: limit + 1,
      include: {
        translations: true,
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
    if (recipes.length === 0) throw new NotFoundException('Recipes not found');

    const hasNextPage = recipes.length > limit;

    const hasPreviousPage = page > 1;

    const items = hasNextPage ? recipes.slice(0, limit) : recipes;

    let returnPage = items.map(({ user, ...recipe }) => ({
      ...recipe,
      username: user?.username ?? null,
    }));
    return { returnPage, hasNextPage, hasPreviousPage };
  }

  async getRecipesByName(name: string) {
    const recipe = await this.prisma.recipe.findMany({
      where: {
        translations: {
          some: {
            title: {
              contains: name,
              mode: 'insensitive',
            },
          },
        },
      },
      include: {
        translations: true,
      },
    });
    return recipe;
  }

  /* 
  GET /api/recipes/:id?lang=it|en|fr
  */
  async getRecipeById(
    id: number,
    lang?: string,
  ): Promise<LocalizedRecipeDetailResponse> {
    // Fetch the recipe from database, joining it with its translations
    const recipe = await this.prisma.recipe.findUnique({
      where: {
        id: id,
      },
      include: {
        translations: true,
        steps: {
          include: {
            translations: true,
          },
          orderBy: {
            step_number: 'asc',
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
            order: 'asc',
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });

    // If recipe is not found -> throw 404 Not Found
    if (!recipe) throw new NotFoundException('Recipe not found');

    // Define requested language from query.
    // Falls back to source language if lang is not supported or not defined.
    const targetLocale =
      lang === 'it' || lang === 'en' || lang === 'fr'
        ? lang
        : recipe.source_lang;

    // Define which translation to send as a response
    const translation =
      recipe.translations.find((t) => t.locale === targetLocale) ??
      recipe.translations.find((t) => t.locale === recipe.source_lang) ??
      recipe.translations[0];

    // Sort recipe steps by their number
    const sortedSteps = [...recipe.steps].sort(
      (a, b) => a.step_number - b.step_number,
    );

    // Organize sorted steps as an array of LocalizedRecipeStepResponse
    const steps: LocalizedRecipeStepResponse[] = sortedSteps.map((s) => {
      const stepTrans =
        s.translations.find((t) => t.locale === targetLocale) ??
        s.translations.find((t) => t.locale === recipe.source_lang) ??
        s.translations[0];
      return {
        id: s.id,
        step_number: s.step_number,
        title: stepTrans?.title ?? null,
        description: stepTrans?.description ?? '',
        duration: s.duration,
        image_url: s.image_url,
      };
    });

    // Organize recipe ingredients as an array of
    // LocalizedRecipeIngredientResponse
    const ingredients: LocalizedRecipeIngredientResponse[] =
      recipe.recipe_ingredients.map((ri) => {
        const ing = ri.ingredient;
        const ingTrans =
          ing.translations.find((t) => t.locale === targetLocale) ??
          ing.translations.find((t) => t.locale === recipe.source_lang) ??
          ing.translations.find((t) => t.locale === 'en');
        let note: string | null = null;
        if (ri.notes) {
          if (typeof ri.notes === 'object' && !Array.isArray(ri.notes)) {
            const notesObj = ri.notes as Record<string, string>;
            note =
              notesObj[targetLocale] ??
              notesObj[recipe.source_lang] ??
              notesObj['en'] ??
              null;
          } else if (typeof ri.notes === 'string') {
            note = ri.notes;
          }
        }
        return {
          id: ing.id,
          slug: ing.slug,
          category: ing.category,
          name: ingTrans?.name ?? ing.slug,
          quantity: Number(ri.quantity),
          unit: ri.unit,
          notes: note,
        };
      });

    // Organize recipe tags as an array of LocalizedRecipeTagResponse
    const tags: LocalizedRecipeTagResponse[] = recipe.recipe_tags.map((rt) => {
      const t = rt.tag;
      const tagTrans =
        t.translations.find((tr) => tr.locale === targetLocale) ??
        t.translations.find((tr) => tr.locale === recipe.source_lang) ??
        t.translations.find((tr) => tr.locale === 'en');
      return {
        id: t.id,
        slug: t.slug,
        name: tagTrans?.name ?? t.slug,
      };
    });

    // Organize recipe media as an array of RecipeMediaResponse
    const media: RecipeMediaResponse[] = (recipe.recipe_media ?? []).map(
      (m) => ({
        id: m.id,
        url: m.url,
        media_type: m.media_type,
        order: m.order,
      }),
    );

    // Return the recipe as an object of type LocalizedRecipeDetailResponse
    return {
      id: recipe.id,
      course: recipe.course,
      difficulty: recipe.difficulty,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      total_time: recipe.total_time,
      servings: recipe.servings,
      source_lang: recipe.source_lang,
      translation_status: recipe.translation_status,
      cover_image_url: recipe.cover_image_url,
      video_url: recipe.video_url,
      created_at: recipe.created_at,
      updated_at: recipe.updated_at,
      author: recipe.user
        ? {
            id: recipe.user.id,
            username: recipe.user.username,
            avatar_url: recipe.user.avatar_url,
          }
        : null,
      title: translation?.title ?? '',
      description: translation?.description ?? '',
      preservation: translation?.preservation ?? null,
      tips: translation?.tips ?? null,
      steps,
      ingredients,
      tags,
      media,
    };
  }

  /* ---------------------------------------------------------------------------
  POST /api/recipes
  --------------------------------------------------------------------------- */
  async createRecipe(recipe: CreateRecipeDto, userId: number) {
    // Language verification
    const textToVerify = [
      recipe.title,
      recipe.description,
      ...recipe.steps.map((s) => s.description),
    ].join(' ');
    await this.translationService.verifySourceLanguage(
      textToVerify,
      recipe.source_lang,
    );

    // Prepare text payload for batch translation
    const allLocales = ['it', 'en', 'fr'];
    const targetLocales = allLocales.filter((l) => l !== recipe.source_lang);
    const textsToTranslate: string[] = [
      recipe.title,
      recipe.description,
      recipe.preservation ?? '',
      recipe.tips ?? '',
    ];
    for (const step of recipe.steps) {
      textsToTranslate.push(step.title ?? '');
      textsToTranslate.push(step.description);
    }

    // Translate across target locales
    let overallTranslationSuccess = true;
    const translationsByLocale: Record<
      string,
      {
        title: string;
        description: string;
        preservation?: string | null;
        tips?: string | null;
        steps: Array<{ title?: string | null; description: string }>;
      }
    > = {};

    // Source locale translation
    translationsByLocale[recipe.source_lang] = {
      title: recipe.title,
      description: recipe.description,
      preservation: recipe.preservation ?? null,
      tips: recipe.tips ?? null,
      steps: recipe.steps.map((s) => ({
        title: s.title ?? null,
        description: s.description,
      })),
    };

    for (const targetLang of targetLocales) {
      const res = await this.translationService.translateBatch(
        textsToTranslate,
        recipe.source_lang,
        targetLang,
      );
      if (!res.success) {
        overallTranslationSuccess = false;
        translationsByLocale[targetLang] = {
          title: recipe.title,
          description: recipe.description,
          preservation: recipe.preservation ?? null,
          tips: recipe.tips ?? null,
          steps: recipe.steps.map((s) => ({
            title: s.title ?? null,
            description: s.description,
          })),
        };
      } else {
        const [transTitle, transDesc, transPres, transTips, ...stepTexts] =
          res.translations;
        const translatedSteps: Array<{
          title?: string | null;
          description: string;
        }> = [];
        for (let i = 0; i < recipe.steps.length; i++) {
          const stepTitle = stepTexts[i * 2] || null;
          const stepDesc = stepTexts[i * 2 + 1] || recipe.steps[i].description;
          translatedSteps.push({
            title: stepTitle,
            description: stepDesc,
          });
        }
        translationsByLocale[targetLang] = {
          title: transTitle || recipe.title,
          description: transDesc || recipe.description,
          preservation: transPres || null,
          tips: transTips || null,
          steps: translatedSteps,
        };
      }
    }

    // Invariant metrics
    const total_time = recipe.prep_time + recipe.cook_time;
    const translation_status = overallTranslationSuccess
      ? TranslationStatus.completed
      : TranslationStatus.failed;

    // Structure relational payload
    const recipeTranslationsData = allLocales.map((locale) => ({
      locale,
      title: translationsByLocale[locale].title,
      description: translationsByLocale[locale].description,
      preservation: translationsByLocale[locale].preservation,
      tips: translationsByLocale[locale].tips,
    }));
    const stepsData = recipe.steps.map((step, index) => ({
      step_number: step.step_number,
      duration: step.duration ?? null,
      translations: {
        create: allLocales.map((locale) => ({
          locale,
          title: translationsByLocale[locale].steps[index]?.title ?? null,
          description:
            translationsByLocale[locale].steps[index]?.description ??
            step.description,
        })),
      },
    }));
    const recipeIngredientsData = recipe.ingredients.map((ing) => ({
      ingredient_id: ing.ingredient_id,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes
        ? typeof ing.notes === 'string'
          ? { [recipe.source_lang]: ing.notes }
          : ing.notes
        : undefined,
    }));
    const recipeTagsData =
      recipe.tag_ids && recipe.tag_ids.length > 0
        ? {
            create: recipe.tag_ids.map((tagId) => ({
              tag_id: tagId,
            })),
          }
        : undefined;

    // Execute database transaction
    return await this.prisma.$transaction(async (tx) => {
      return await tx.recipe.create({
        data: {
          user_id: userId,
          owner_type: OwnerType.user,
          course: recipe.course,
          difficulty: recipe.difficulty,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          total_time,
          servings: recipe.servings,
          source_lang: recipe.source_lang,
          translation_status,
          translations: {
            create: recipeTranslationsData,
          },
          steps: {
            create: stepsData,
          },
          recipe_ingredients: {
            create: recipeIngredientsData,
          },
          recipe_tags: recipeTagsData,
        },
      });
    });
  }

  /* 
  PATCH /api/recipes/:id
  */
  async updateRecipe(
    userId: number,
    recipeId: number,
    recipeUpdate: UpdateRecipeDto | any,
  ) {
    const recipe = await this.prisma.recipe.findUnique({
      where: {
        id: recipeId,
      },
    });
    if (!recipe || recipe.user_id != userId)
      throw new NotFoundException('Recipe not found');
    return await this.prisma.recipe.update({
      where: {
        id: recipeId,
      },
      data: recipeUpdate,
    });
  }

  /* 
  DELETE /api/recipes/:id
  */
  async deleteRecipe(recipeId: number, userId: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: {
        id: recipeId,
      },
    });
    if (!recipe || recipe.user_id != userId)
      throw new NotFoundException('Recipe not found');
    return await this.prisma.recipe.delete({
      where: {
        id: recipeId,
      },
    });
  }
}
