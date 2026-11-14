import * as fs from 'fs';
import * as path from 'path';
import { IngredientCategory, PrismaClient } from '@prisma/client';

export interface CatalogIngredientSeed {
  slug: string;
  category: IngredientCategory;
  translations: {
    it: string;
    en: string;
    fr: string;
  };
}

export interface CatalogTagSeed {
  slug: string;
  translations: {
    it: string;
    en: string;
    fr: string;
  };
}

function loadSeedJson<T>(filename: string): T {
  const candidates = [
    path.resolve(__dirname, '../data', filename),
    path.resolve(process.cwd(), 'prisma/seed/data', filename),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf8')) as T;
    }
  }
  throw new Error(`Seed data file not found: ${filename}`);
}

/**
 * Upserts curated ingredients and tags idempotently.
 */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const ingredients = loadSeedJson<CatalogIngredientSeed[]>('ingredients.json');
  const tags = loadSeedJson<CatalogTagSeed[]>('tags.json');

  for (const item of ingredients) {
    const ingredient = await prisma.ingredient.upsert({
      where: { slug: item.slug },
      update: { category: item.category },
      create: { slug: item.slug, category: item.category },
    });

    for (const locale of ['it', 'en', 'fr'] as const) {
      await prisma.ingredientTranslation.upsert({
        where: {
          ingredient_id_locale: {
            ingredient_id: ingredient.id,
            locale,
          },
        },
        update: { name: item.translations[locale] },
        create: {
          ingredient_id: ingredient.id,
          locale,
          name: item.translations[locale],
        },
      });
    }
  }

  for (const item of tags) {
    const tag = await prisma.tag.upsert({
      where: { slug: item.slug },
      update: {},
      create: { slug: item.slug },
    });

    for (const locale of ['it', 'en', 'fr'] as const) {
      await prisma.tagTranslation.upsert({
        where: {
          tag_id_locale: {
            tag_id: tag.id,
            locale,
          },
        },
        update: { name: item.translations[locale] },
        create: {
          tag_id: tag.id,
          locale,
          name: item.translations[locale],
        },
      });
    }
  }

  console.log(
    `[seed:catalog] Upserted ${ingredients.length} ingredients and ${tags.length} tags.`,
  );
}
