import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Course,
  RecipeDifficulty,
  UnitOfMeasure,
  IngredientCategory,
} from '@prisma/client';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory/casl-ability.factory';
import { Action } from '../auth/casl/action.enum';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { createHttpException, errors } from '../common/config/error.config';
import { CreateIngredientDto } from './dto/create-ingredient.dto';

import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caslAbilityFactory: CaslAbilityFactory,
  ) {}

  /*
  GET /api/recipes/metadata
  Provides client applications (frontend) with all static enum dictionaries
  in a single HTTP call.
  */
  getMetadata() {
    return {
      courses: Object.values(Course),
      difficulties: Object.values(RecipeDifficulty),
      units: Object.values(UnitOfMeasure),
      categories: Object.values(IngredientCategory),
    };
  }

  /*
  GET /api/tags
  Returns all the possible tags for a recipe (vegetarian, vegan, etc.),
  ordered alfabetically by name.
  */
  async getTags(params: { lang?: string } = {}) {
    // Checks user locale, if unsupported defaults to English
    const locale =
      params.lang === 'it' || params.lang === 'fr' ? params.lang : 'en';
    // Fetches all rows of the Tag table
    const tags = await this.prisma.tag.findMany({
      // Retrieves up to two translation of every tag from the TagTranslation
      // table: 'en' tag and the eventual 'it' or 'fr' translation of that tag
      include: {
        translations: {
          where: { locale: { in: [locale, 'en'] } },
        },
      },
      // Order the tags alphabetically by slug in ascending order
      orderBy: { slug: 'asc' },
    });
    // Maps the fetch data to return an array of tags objects formatted as
    // { id, slug, name }
    const mapped = tags.map((t) => {
      // Gets the translated tag name, if it exists in the user language.
      // Falls back to English if the translation is missing
      const trans =
        t.translations.find((tr) => tr.locale === locale) ??
        t.translations.find((tr) => tr.locale === 'en');
      // Return every tag as an object { id, slug, name }. The name falls back
      // to the slug as a last resort, if neither translation exists
      return {
        id: t.id,
        slug: t.slug,
        name: trans?.name ?? t.slug,
        resolved_lang: trans?.locale ?? 'en',
      };
    });
    // Returns the array of tags ordered by name
    return mapped.sort((a, b) => a.name.localeCompare(b.name, locale));
  }

  /* 
  GET /api/ingredients
  Returns a list of ingredients for a recipe, ordered alphabetically by name.
  @param lang: Language of returned ingredients (default 'en').
  @param category: Limit the list to a specific category of ingredients.
  @param search: Search ingredients containing this term in the name/slug.
  */
  async getIngredients(
    params: {
      lang?: string;
      category?: IngredientCategory;
      search?: string;
    } = {},
  ) {
    // Checks user locale, if unsupported defaults to English
    const locale =
      params.lang === 'it' || params.lang === 'fr' ? params.lang : 'en';
    // Prisma filter used to select only specific ingredients
    const where: any = {};
    // Filter ingredients by 'category' parameter
    if (params.category) {
      where.category = params.category;
    }
    // Filter ingredients by 'search' parameter
    if (params.search && params.search.trim()) {
      // Trims spaces from the searched parameter
      const term = params.search.trim();
      // Builds a Prisma OR filter: selects all objects that satisfy at
      // least one condition.
      where.OR = [
        // Condition: select if slug contains term (case-insensitive)
        { slug: { contains: term, mode: 'insensitive' } },
        // Condition: select if at least one translation row for this
        // ingredient has a name containing term (case-insensitive)
        {
          translations: {
            some: {
              name: { contains: term, mode: 'insensitive' },
            },
          },
        },
      ];
    }
    // Fetches all rows of the Ingredient table
    const ingredients = await this.prisma.ingredient.findMany({
      // Select rows that respect the 'where' filter
      where,
      // Retrieves up to two translation of every ingredient from the
      // IngredientTranslation table: 'en' and eventual locale
      include: {
        translations: {
          where: { locale: { in: [locale, 'en'] } },
        },
      },
      // Order the ingredients alphabetically by slug in ascending order
      orderBy: { slug: 'asc' },
    });
    // Maps the fetch data to return an array of ingredients objects formatted
    // as { id, slug, name }
    const mapped = ingredients.map((i) => {
      const trans =
        i.translations.find((tr) => tr.locale === locale) ??
        i.translations.find((tr) => tr.locale === 'en');
      return {
        id: i.id,
        slug: i.slug,
        category: i.category,
        name: trans?.name ?? i.slug,
        resolved_lang: trans?.locale ?? 'en',
      };
    });
    // Returns the array of ingredients ordered by name
    return mapped.sort((a, b) => a.name.localeCompare(b.name, locale));
  }

  /*
  POST /api/ingredients
  Adds a new ingredient to the curated catalog (admin only, enforced by CASL).
  The ingredient row and its three translation rows (it, en, fr) are created
  in a single nested write, so either everything is saved or nothing is.
  @param user: Authenticated user performing the request.
  @param dto: Slug, category and the name in each supported language.
  */
  async createIngredient(user: ActiveUserData, dto: CreateIngredientDto) {
    // Only roles allowed to create Ingredients pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Create, 'Ingredient');

    // Friendly 409 if the slug is already taken. A concurrent request that
    // slips through is still caught by the DB unique constraint (P2002),
    // which the global exception filter turns into a 409 as well.
    const existing = await this.prisma.ingredient.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw createHttpException(
        errors.ingredients.alreadyExists,
        `Ingredient with slug '${dto.slug}' already exists`,
      );
    }

    // Creates the ingredient together with its translations
    const created = await this.prisma.ingredient.create({
      data: {
        slug: dto.slug,
        category: dto.category,
        translations: {
          create: [
            { locale: 'it', name: dto.translations.it },
            { locale: 'en', name: dto.translations.en },
            { locale: 'fr', name: dto.translations.fr },
          ],
        },
      },
      include: { translations: true },
    });

    // Maps the stored rows to { id, slug, category, translations: {it,en,fr} }
    const nameOf = (locale: string) =>
      created.translations.find((t) => t.locale === locale)?.name ?? '';
    return {
      id: created.id,
      slug: created.slug,
      category: created.category,
      translations: {
        it: nameOf('it'),
        en: nameOf('en'),
        fr: nameOf('fr'),
      },
    };
  }
    /*
  POST /api/tags
  Adds a new tag to the curated catalog (admin only, enforced by CASL).
  The tag row and its three translation rows (it, en, fr) are created in a
  single nested write, so either everything is saved or nothing is.
  @param user: Authenticated user performing the request.
  @param dto: Slug and the display name in each supported language.
  */
  async createTag(user: ActiveUserData, dto: CreateTagDto) {
    // Only roles allowed to create Tags pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Create, 'Tag');

    // Friendly 409 if the slug is already taken. A concurrent request that
    // slips through is still caught by the DB unique constraint (P2002),
    // which the global exception filter turns into a 409 as well.
    const existing = await this.prisma.tag.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw createHttpException(
        errors.tags.alreadyExists,
        `Tag with slug '${dto.slug}' already exists`,
      );
    }

    // Creates the tag together with its translations
    const created = await this.prisma.tag.create({
      data: {
        slug: dto.slug,
        translations: {
          create: [
            { locale: 'it', name: dto.translations.it },
            { locale: 'en', name: dto.translations.en },
            { locale: 'fr', name: dto.translations.fr },
          ],
        },
      },
      include: { translations: true },
    });

    return this.toTagDetail(created);
  }
  /*
  PATCH /api/tags/:id
  Updates the Italian, English and French names of an existing tag
  (admin only, enforced by CASL). The slug is immutable: it is the stable
  key used by seeds, filters and references, so it cannot be changed here.
  @param user: Authenticated user performing the request.
  @param id: Primary key of the tag to update.
  @param dto: The new display name in each supported language.
  */
  async updateTag(user: ActiveUserData, id: number, dto: UpdateTagDto) {
    // Only roles allowed to update Tags pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Update, 'Tag');

    // 404 if the tag does not exist
    const existing = await this.prisma.tag.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw createHttpException(errors.tags.notFound);
    }

    // Upserts the three translations in a single nested write, so a missing
    // translation row (edge case) is created instead of failing the update.
    const updated = await this.prisma.tag.update({
      where: { id },
      data: {
        translations: {
          upsert: [
            {
              where: { tag_id_locale: { tag_id: id, locale: 'it' } },
              create: { locale: 'it', name: dto.translations.it },
              update: { name: dto.translations.it },
            },
            {
              where: { tag_id_locale: { tag_id: id, locale: 'en' } },
              create: { locale: 'en', name: dto.translations.en },
              update: { name: dto.translations.en },
            },
            {
              where: { tag_id_locale: { tag_id: id, locale: 'fr' } },
              create: { locale: 'fr', name: dto.translations.fr },
              update: { name: dto.translations.fr },
            },
          ],
        },
      },
      include: { translations: true },
    });

    return this.toTagDetail(updated);
  }

  /*
  Maps a stored Tag (with its translations) to the public response shape
  { id, slug, translations: { it, en, fr } }.
  */
  private toTagDetail(tag: {
    id: number;
    slug: string;
    translations: { locale: string; name: string }[];
  }) {
    const nameOf = (locale: string) =>
      tag.translations.find((t) => t.locale === locale)?.name ?? '';
    return {
      id: tag.id,
      slug: tag.slug,
      translations: {
        it: nameOf('it'),
        en: nameOf('en'),
        fr: nameOf('fr'),
      },
    };
  }

    /*
  DELETE /api/ingredients/:id
  Deletes a curated ingredient (admin only, enforced by CASL).
  Refuses with 409 if the ingredient is referenced by at least one recipe,
  so recipes are never left with dangling ingredient references.
  @param user: Authenticated user performing the request.
  @param id: Primary key of the ingredient to delete.
  */
  async deleteIngredient(user: ActiveUserData, id: number) {
    // Only roles allowed to delete Ingredients pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Delete, 'Ingredient');

    // 404 if the ingredient does not exist
    const existing = await this.prisma.ingredient.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) {
      throw createHttpException(errors.ingredients.notFound);
    }

    // 409 if the ingredient is referenced by at least one recipe
    const usageCount = await this.prisma.recipeIngredient.count({
      where: { ingredient_id: id },
    });
    if (usageCount > 0) {
      throw createHttpException(
        errors.ingredients.inUse,
        `Ingredient '${existing.slug}' is used in ${usageCount} recipe(s) and cannot be deleted`,
      );
    }

    // Deletes the ingredient; translations are removed by cascade
    await this.prisma.ingredient.delete({ where: { id } });

    return { message: `Ingredient '${existing.slug}' deleted successfully` };
  }

  /*
  DELETE /api/tags/:id
  Deletes a curated tag (admin only, enforced by CASL).
  Refuses with 409 if the tag is referenced by at least one recipe, so
  recipes are never silently stripped of a tag they use.
  @param user: Authenticated user performing the request.
  @param id: Primary key of the tag to delete.
  */
  async deleteTag(user: ActiveUserData, id: number) {
    // Only roles allowed to delete Tags pass (admin); others get 403
    this.caslAbilityFactory.check(user, Action.Delete, 'Tag');

    // 404 if the tag does not exist
    const existing = await this.prisma.tag.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });
    if (!existing) {
      throw createHttpException(errors.tags.notFound);
    }

    // 409 if the tag is referenced by at least one recipe
    const usageCount = await this.prisma.recipeTag.count({
      where: { tag_id: id },
    });
    if (usageCount > 0) {
      throw createHttpException(
        errors.tags.inUse,
        `Tag '${existing.slug}' is used in ${usageCount} recipe(s) and cannot be deleted`,
      );
    }

    // Deletes the tag; translations are removed by cascade
    await this.prisma.tag.delete({ where: { id } });

    return { message: `Tag '${existing.slug}' deleted successfully` };
  }
}
