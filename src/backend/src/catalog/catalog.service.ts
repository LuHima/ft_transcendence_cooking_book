import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Course, RecipeDifficulty, UnitOfMeasure, IngredientCategory } from '@prisma/client';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  getMeta() {
    return {
      courses: Object.values(Course),
      difficulties: Object.values(RecipeDifficulty),
      units: Object.values(UnitOfMeasure),
      categories: Object.values(IngredientCategory),
    };
  }

  async getTags(params: { lang?: string } = {}) {
    const locale = (params.lang === 'it' || params.lang === 'fr') ? params.lang : 'en';
    const tags = await this.prisma.tag.findMany({
      include: {
        translations: {
          where: { locale: { in: [locale, 'en'] } },
        },
      },
      orderBy: { slug: 'asc' },
    });

    return tags.map((t) => {
      const trans = t.translations.find((tr) => tr.locale === locale)
        ?? t.translations.find((tr) => tr.locale === 'en');
      return {
        id: t.id,
        slug: t.slug,
        name: trans?.name ?? t.slug,
      };
    });
  }

  async getIngredients(params: {
    lang?: string;
    category?: IngredientCategory;
    search?: string;
  } = {}) {
    const locale = (params.lang === 'it' || params.lang === 'fr') ? params.lang : 'en';

    const where: any = {};
    if (params.category) {
      where.category = params.category;
    }

    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      where.OR = [
        { slug: { contains: term, mode: 'insensitive' } },
        {
          translations: {
            some: {
              name: { contains: term, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const ingredients = await this.prisma.ingredient.findMany({
      where,
      include: {
        translations: {
          where: { locale: { in: [locale, 'en'] } },
        },
      },
      orderBy: { slug: 'asc' },
    });

    return ingredients.map((i) => {
      const trans = i.translations.find((tr) => tr.locale === locale)
        ?? i.translations.find((tr) => tr.locale === 'en');
      return {
        id: i.id,
        slug: i.slug,
        category: i.category,
        name: trans?.name ?? i.slug,
      };
    });
  }
}
