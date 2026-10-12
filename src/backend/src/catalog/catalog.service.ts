import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Course,
  RecipeDifficulty,
  UnitOfMeasure,
  IngredientCategory,
} from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

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
      };
    });
    // Returns the array of ingredients ordered by name
    return mapped.sort((a, b) => a.name.localeCompare(b.name, locale));
  }
}
