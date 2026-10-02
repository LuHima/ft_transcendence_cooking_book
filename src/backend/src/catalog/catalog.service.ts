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
      orderBy: { slug: 'asc' },
    });

    return tags.map((t) => {
      let name = t.name_en;
      if (locale === 'it' && t.name_it) name = t.name_it;
      if (locale === 'fr' && t.name_fr) name = t.name_fr;
      return {
        id: t.id,
        slug: t.slug,
        name,
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
        { name_it: { contains: term, mode: 'insensitive' } },
        { name_en: { contains: term, mode: 'insensitive' } },
        { name_fr: { contains: term, mode: 'insensitive' } },
      ];
    }

    const ingredients = await this.prisma.ingredient.findMany({
      where,
      orderBy: { slug: 'asc' },
    });

    return ingredients.map((i) => {
      let name = i.name_en;
      if (locale === 'it' && i.name_it) name = i.name_it;
      if (locale === 'fr' && i.name_fr) name = i.name_fr;
      return {
        id: i.id,
        slug: i.slug,
        category: i.category,
        name,
      };
    });
  }
}
