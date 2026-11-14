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

const CHUNK_SIZE = 1000;
const LOCALES = ['it', 'en', 'fr'] as const;

export function loadSeedJson<T>(filename: string): T {
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Bulk-upserts curated ingredients and tags using chunked PostgreSQL UNNEST
 * `INSERT ... ON CONFLICT DO UPDATE` so startup stays sub-second and
 * existing `RecipeIngredient` / `RecipeTag` foreign keys remain intact.
 */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
  const ingredients = loadSeedJson<CatalogIngredientSeed[]>('ingredients.json');
  const tags = loadSeedJson<CatalogTagSeed[]>('tags.json');

  for (const batch of chunkArray(ingredients, CHUNK_SIZE)) {
    const slugs = batch.map((i) => i.slug);
    const categories = batch.map((i) => i.category);

    await prisma.$executeRawUnsafe(
      `INSERT INTO ingredients (slug, category)
       SELECT t.slug, t.category::"IngredientCategory"
       FROM UNNEST($1::text[], $2::text[]) AS t(slug, category)
       ON CONFLICT (slug) DO UPDATE
       SET category = EXCLUDED.category`,
      slugs,
      categories,
    );

    const trSlugs: string[] = [];
    const trLocales: string[] = [];
    const trNames: string[] = [];
    for (const item of batch) {
      for (const locale of LOCALES) {
        trSlugs.push(item.slug);
        trLocales.push(locale);
        trNames.push(item.translations[locale]);
      }
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO ingredient_translations (ingredient_id, locale, name)
       SELECT i.id, t.locale, t.name
       FROM UNNEST($1::text[], $2::text[], $3::text[]) AS t(slug, locale, name)
       JOIN ingredients i ON i.slug = t.slug
       ON CONFLICT (ingredient_id, locale) DO UPDATE
       SET name = EXCLUDED.name`,
      trSlugs,
      trLocales,
      trNames,
    );
  }

  for (const batch of chunkArray(tags, CHUNK_SIZE)) {
    const slugs = batch.map((t) => t.slug);

    await prisma.$executeRawUnsafe(
      `INSERT INTO tags (slug)
       SELECT t.slug
       FROM UNNEST($1::text[]) AS t(slug)
       ON CONFLICT (slug) DO NOTHING`,
      slugs,
    );

    const trSlugs: string[] = [];
    const trLocales: string[] = [];
    const trNames: string[] = [];
    for (const item of batch) {
      for (const locale of LOCALES) {
        trSlugs.push(item.slug);
        trLocales.push(locale);
        trNames.push(item.translations[locale]);
      }
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO tag_translations (tag_id, locale, name)
       SELECT tg.id, t.locale, t.name
       FROM UNNEST($1::text[], $2::text[], $3::text[]) AS t(slug, locale, name)
       JOIN tags tg ON tg.slug = t.slug
       ON CONFLICT (tag_id, locale) DO UPDATE
       SET name = EXCLUDED.name`,
      trSlugs,
      trLocales,
      trNames,
    );
  }

  console.log(
    `[seed:catalog] Bulk-upserted ${ingredients.length} ingredients and ${tags.length} tags.`,
  );
}
