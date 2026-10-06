import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import { MediaType, OwnerType, TranslationStatus } from '@prisma/client';
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

  // ---------------------------------------------------------------------------

  public async getAllRecipe(who?: 'user' | 'id') {
    // Return the temporary test response when a filter is provided
    // ! who e' solo per testare
    if (who) {
      return 'hello';
    }

    // Fetch all recipes together with their translations
    return await this.prisma.recipe.findMany({
      include: {
        translations: true,
      },
    });
  }

  // ---------------------------------------------------------------------------

  public async getRecipeStack(page: number) {
    // Configure the page size and validate the requested page
    let limit: number = 30;
    if (!page || page < 1) {
      throw new BadRequestException('Page number must be greater than 0');
    }

    // Fetch one extra recipe to determine whether another page exists
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

    // Trim the look-ahead item and build pagination metadata
    const hasNextPage = recipes.length > limit;
    const hasPreviousPage = page > 1;
    const items = hasNextPage ? recipes.slice(0, limit) : recipes;
    let returnPage = items.map(({ user, ...recipe }) => ({
      ...recipe,
      username: user?.username ?? null,
    }));
    return { returnPage, hasNextPage, hasPreviousPage };
  }

  // ---------------------------------------------------------------------------

  async getRecipesByName(name: string) {
    // Search translated recipe titles without regard to letter casing
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

    // Include every translation needed by the caller
    return recipe;
  }

  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------

  /* 
  POST /api/recipes
  */
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

  // ---------------------------------------------------------------------------

  /* 
  PATCH /api/recipes/:id
  */
  async updateRecipe(
    userId: number,
    recipeId: number,
    recipeUpdate: UpdateRecipeDto,
    retranslate?: boolean,
  ) {
    // Fetch recipe with translations and steps to verify existence and
    // ownership
    const recipe = await this.prisma.recipe.findUnique({
      where: {
        id: recipeId,
      },
      include: {
        translations: true,
        steps: {
          include: { translations: true },
          orderBy: { step_number: 'asc' },
        },
      },
    });

    // Guard: Verify ownership (only author can update recipe)
    if (!recipe || recipe.user_id !== userId)
      throw new NotFoundException('Recipe not found');

    // Update locale-invariant data of the recipe
    const updateData: any = {};
    if (recipeUpdate.course !== undefined)
      updateData.course = recipeUpdate.course;
    if (recipeUpdate.difficulty !== undefined)
      updateData.difficulty = recipeUpdate.difficulty;
    if (recipeUpdate.servings !== undefined)
      updateData.servings = recipeUpdate.servings;
    if (recipeUpdate.prep_time !== undefined)
      updateData.prep_time = recipeUpdate.prep_time;
    if (recipeUpdate.cook_time !== undefined)
      updateData.cook_time = recipeUpdate.cook_time;

    // Recalculate total_time if prep_time or cook_time was modified
    if (
      recipeUpdate.prep_time !== undefined ||
      recipeUpdate.cook_time !== undefined
    ) {
      const pTime =
        recipeUpdate.prep_time !== undefined
          ? recipeUpdate.prep_time
          : recipe.prep_time;
      const cTime =
        recipeUpdate.cook_time !== undefined
          ? recipeUpdate.cook_time
          : recipe.cook_time;
      updateData.total_time = pTime + cTime;
    }

    // Determine target locale for translation update (defaults to recipe
    // source_lang)
    const targetLocale = recipeUpdate.locale ?? recipe.source_lang;
    const transUpdate: any = {};
    if (recipeUpdate.title !== undefined)
      transUpdate.title = recipeUpdate.title;
    if (recipeUpdate.description !== undefined)
      transUpdate.description = recipeUpdate.description;
    if (recipeUpdate.preservation !== undefined)
      transUpdate.preservation = recipeUpdate.preservation;
    if (recipeUpdate.tips !== undefined) transUpdate.tips = recipeUpdate.tips;

    const translatedDataByLocale: Record<
      string,
      {
        title: string;
        description: string;
        preservation?: string | null;
        tips?: string | null;
        steps: Array<{
          stepId: number;
          title: string | null;
          description: string;
        }>;
      }
    > = {};

    // Re-translate content across remaining locales if retranslate flag is
    // enabled
    if (retranslate) {
      // Resolve canonical source text combining existing values with incoming
      // updates
      const sourceTrans = recipe.translations?.find(
        (t) => t.locale === recipe.source_lang,
      );
      const sourceTitle =
        (targetLocale === recipe.source_lang
          ? recipeUpdate.title
          : undefined) ??
        sourceTrans?.title ??
        recipeUpdate.title ??
        '';
      const sourceDesc =
        (targetLocale === recipe.source_lang
          ? recipeUpdate.description
          : undefined) ??
        sourceTrans?.description ??
        recipeUpdate.description ??
        '';
      const sourcePres =
        (targetLocale === recipe.source_lang
          ? recipeUpdate.preservation
          : undefined) ??
        sourceTrans?.preservation ??
        recipeUpdate.preservation ??
        null;
      const sourceTips =
        (targetLocale === recipe.source_lang ? recipeUpdate.tips : undefined) ??
        sourceTrans?.tips ??
        recipeUpdate.tips ??
        null;

      // Prepare text payload for batch machine translation
      const textsToTranslate: string[] = [
        sourceTitle,
        sourceDesc,
        sourcePres ?? '',
        sourceTips ?? '',
      ];

      for (const step of recipe.steps ?? []) {
        const stepSourceTrans = step.translations?.find(
          (t) => t.locale === recipe.source_lang,
        );
        textsToTranslate.push(stepSourceTrans?.title ?? '');
        textsToTranslate.push(stepSourceTrans?.description ?? '');
      }

      // Execute machine translation across all other target locales
      const allLocales = ['it', 'en', 'fr'];
      const targetLocales = allLocales.filter((l) => l !== recipe.source_lang);
      let overallSuccess = true;

      for (const targetLang of targetLocales) {
        const res = await this.translationService.translateBatch(
          textsToTranslate,
          recipe.source_lang,
          targetLang,
        );
        if (!res.success) {
          overallSuccess = false;
          break;
        }
        const [transTitle, transDesc, transPres, transTips, ...stepTexts] =
          res.translations;
        const stepTranslations: Array<{
          stepId: number;
          title: string | null;
          description: string;
        }> = [];
        for (let i = 0; i < (recipe.steps ?? []).length; i++) {
          const step = recipe.steps[i];
          const sTitle = stepTexts[i * 2] || null;
          const sDesc = stepTexts[i * 2 + 1] || '';
          stepTranslations.push({
            stepId: step.id,
            title: sTitle,
            description: sDesc,
          });
        }
        translatedDataByLocale[targetLang] = {
          title: transTitle || sourceTitle,
          description: transDesc || sourceDesc,
          preservation: transPres || null,
          tips: transTips || null,
          steps: stepTranslations,
        };
      }

      // Update translation status based on batch translation result
      updateData.translation_status = overallSuccess ? 'completed' : 'failed';
    }

    // Execute atomic database updates inside transaction
    return await this.prisma.$transaction(async (tx) => {
      // Upsert direct translation modifications for the targeted locale
      if (Object.keys(transUpdate).length > 0) {
        await tx.recipeTranslation.upsert({
          where: {
            recipe_id_locale: {
              recipe_id: recipeId,
              locale: targetLocale,
            },
          },
          create: {
            recipe_id: recipeId,
            locale: targetLocale,
            title: recipeUpdate.title ?? '',
            description: recipeUpdate.description ?? '',
            preservation: recipeUpdate.preservation ?? null,
            tips: recipeUpdate.tips ?? null,
          },
          update: transUpdate,
        });
      }

      // Upsert re-translated content for remaining locales when retranslate
      // succeeded
      if (retranslate && updateData.translation_status === 'completed') {
        for (const [locale, trans] of Object.entries(translatedDataByLocale)) {
          await tx.recipeTranslation.upsert({
            where: {
              recipe_id_locale: {
                recipe_id: recipeId,
                locale,
              },
            },
            create: {
              recipe_id: recipeId,
              locale,
              title: trans.title,
              description: trans.description,
              preservation: trans.preservation,
              tips: trans.tips,
            },
            update: {
              title: trans.title,
              description: trans.description,
              preservation: trans.preservation,
              tips: trans.tips,
            },
          });

          for (const stepTrans of trans.steps) {
            await tx.recipeStepTranslation.upsert({
              where: {
                step_id_locale: {
                  step_id: stepTrans.stepId,
                  locale,
                },
              },
              create: {
                step_id: stepTrans.stepId,
                locale,
                title: stepTrans.title,
                description: stepTrans.description,
              },
              update: {
                title: stepTrans.title,
                description: stepTrans.description,
              },
            });
          }
        }
      }

      // Update invariant recipe fields and translation status
      return await tx.recipe.update({
        where: {
          id: recipeId,
        },
        data: updateData,
      });
    });
  }

  // ---------------------------------------------------------------------------

  /* 
  DELETE /api/recipes/:id
  */
  async deleteRecipe(recipeId: number, userId: number) {
    // Verify that the recipe exists and belongs to the requesting user
    const recipe = await this.prisma.recipe.findUnique({
      where: {
        id: recipeId,
      },
    });
    if (!recipe || recipe.user_id != userId)
      throw new NotFoundException('Recipe not found');

    // Delete the verified recipe
    return await this.prisma.recipe.delete({
      where: {
        id: recipeId,
      },
    });
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/translate
  */
  async retryTranslation(recipeId: number, userId: number) {
    // Fetch the recipe from database, joining it with its translations and
    // ordered steps
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        translations: true,
        steps: {
          include: { translations: true },
          orderBy: { step_number: 'asc' },
        },
      },
    });

    // Guard: Verify ownership (only author can retry translation)
    if (!recipe || recipe.user_id !== userId) {
      throw new NotFoundException('Recipe not found');
    }

    // Guard: Only allow retry when previous translation status failed
    if (recipe.translation_status !== 'failed') {
      throw new BadRequestException(
        'Translation retry is only available for failed translations',
      );
    }

    // Find original language canonical translation
    const sourceTrans = recipe.translations.find(
      (t) => t.locale === recipe.source_lang,
    );
    if (!sourceTrans) {
      throw new NotFoundException('Source translation not found');
    }

    // Prepare text payload for batch translation
    const allLocales = ['it', 'en', 'fr'];
    const targetLocales = allLocales.filter((l) => l !== recipe.source_lang);
    const textsToTranslate: string[] = [
      sourceTrans.title,
      sourceTrans.description,
      sourceTrans.preservation ?? '',
      sourceTrans.tips ?? '',
    ];
    for (const step of recipe.steps) {
      const stepSourceTrans = step.translations.find(
        (t) => t.locale === recipe.source_lang,
      );
      textsToTranslate.push(stepSourceTrans?.title ?? '');
      textsToTranslate.push(stepSourceTrans?.description ?? '');
    }

    // Translate across target locales
    let overallSuccess = true;
    const translatedDataByLocale: Record<
      string,
      {
        title: string;
        description: string;
        preservation?: string | null;
        tips?: string | null;
        steps: Array<{
          stepId: number;
          title: string | null;
          description: string;
        }>;
      }
    > = {};

    for (const targetLang of targetLocales) {
      const res = await this.translationService.translateBatch(
        textsToTranslate,
        recipe.source_lang,
        targetLang,
      );
      if (!res.success) {
        overallSuccess = false;
        break;
      }
      const [transTitle, transDesc, transPres, transTips, ...stepTexts] =
        res.translations;
      const stepTranslations: Array<{
        stepId: number;
        title: string | null;
        description: string;
      }> = [];
      for (let i = 0; i < recipe.steps.length; i++) {
        const step = recipe.steps[i];
        const sTitle = stepTexts[i * 2] || null;
        const sDesc = stepTexts[i * 2 + 1] || '';
        stepTranslations.push({
          stepId: step.id,
          title: sTitle,
          description: sDesc,
        });
      }
      translatedDataByLocale[targetLang] = {
        title: transTitle || sourceTrans.title,
        description: transDesc || sourceTrans.description,
        preservation: transPres || null,
        tips: transTips || null,
        steps: stepTranslations,
      };
    }

    // If translation service failed, maintain failed status in database
    if (!overallSuccess) {
      return await this.prisma.recipe.update({
        where: { id: recipe.id },
        data: { translation_status: 'failed' },
      });
    }

    // Execute database transaction to persist translated records and set
    // status to completed
    return await this.prisma.$transaction(async (tx) => {
      // Upsert translations for each target locale
      for (const [locale, trans] of Object.entries(translatedDataByLocale)) {
        await tx.recipeTranslation.upsert({
          where: {
            recipe_id_locale: {
              recipe_id: recipe.id,
              locale,
            },
          },
          create: {
            recipe_id: recipe.id,
            locale,
            title: trans.title,
            description: trans.description,
            preservation: trans.preservation,
            tips: trans.tips,
          },
          update: {
            title: trans.title,
            description: trans.description,
            preservation: trans.preservation,
            tips: trans.tips,
          },
        });

        // Upsert step translations for each step in this locale
        for (const stepTrans of trans.steps) {
          await tx.recipeStepTranslation.upsert({
            where: {
              step_id_locale: {
                step_id: stepTrans.stepId,
                locale,
              },
            },
            create: {
              step_id: stepTrans.stepId,
              locale,
              title: stepTrans.title,
              description: stepTrans.description,
            },
            update: {
              title: stepTrans.title,
              description: stepTrans.description,
            },
          });
        }
      }

      // Update recipe translation status to completed
      return await tx.recipe.update({
        where: { id: recipe.id },
        data: { translation_status: 'completed' },
      });
    });
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/cover
  */
  async uploadCoverImage(
    recipeId: number,
    userId: number,
    file: Express.Multer.File,
  ) {
    // Guard: Verify recipe existence and caller ownership
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe || recipe.user_id !== userId) {
      throw new NotFoundException('Recipe not found');
    }

    const fileUrl = `/uploads/recipes/${file.filename || file.originalname}`;

    // Update cover_image_url on recipe
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { cover_image_url: fileUrl },
    });

    return { cover_image_url: fileUrl };
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/steps/:stepNumber/image
  */
  async uploadStepImage(
    recipeId: number,
    stepNumber: number,
    userId: number,
    file: Express.Multer.File,
  ) {
    // Guard: Verify recipe existence and caller ownership
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe || recipe.user_id !== userId) {
      throw new NotFoundException('Recipe not found');
    }

    // Guard: Verify recipe step exists
    const step = await this.prisma.recipeStep.findFirst({
      where: {
        recipe_id: recipeId,
        step_number: stepNumber,
      },
    });
    if (!step) {
      throw new NotFoundException('Recipe step not found');
    }

    const fileUrl = `/uploads/recipes/${file.filename || file.originalname}`;

    // Update image_url on step
    await this.prisma.recipeStep.update({
      where: { id: step.id },
      data: { image_url: fileUrl },
    });

    return { step_number: stepNumber, image_url: fileUrl };
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/gallery
  */
  async uploadGalleryMedia(
    recipeId: number,
    userId: number,
    files: Express.Multer.File[],
  ) {
    // Guard: Verify recipe existence and caller ownership
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe || recipe.user_id !== userId) {
      throw new NotFoundException('Recipe not found');
    }

    // Guard: Validate that at least one file is provided
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file must be provided');
    }

    // Guard: Fetch existing gallery media and ensure limit of 3 is respected
    const existingMedia = await this.prisma.recipeMedia.findMany({
      where: {
        recipe_id: recipeId,
        media_type: MediaType.image,
      },
      orderBy: { order: 'asc' },
    });

    if (existingMedia.length + files.length > 3) {
      throw new BadRequestException(
        `Cannot upload more than 3 gallery images per recipe. Already has ${existingMedia.length}.`,
      );
    }

    // Persist each gallery media item with sequential ordering
    const createdMedia: any[] = [];
    const startingOrder = existingMedia.length;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileUrl = `/uploads/recipes/${file.filename || file.originalname}`;
      const media = await this.prisma.recipeMedia.create({
        data: {
          recipe_id: recipeId,
          url: fileUrl,
          media_type: MediaType.image,
          order: startingOrder + i,
        },
      });
      createdMedia.push(media);
    }

    return createdMedia;
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/video
  */
  async uploadVideo(
    recipeId: number,
    userId: number,
    file: Express.Multer.File,
  ) {
    // Guard: Verify recipe existence and caller ownership
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });
    if (!recipe || recipe.user_id !== userId) {
      throw new NotFoundException('Recipe not found');
    }

    const fileUrl = `/uploads/recipes/${file.filename || file.originalname}`;

    // Update video_url on recipe
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { video_url: fileUrl },
    });

    return { video_url: fileUrl };
  }
}
