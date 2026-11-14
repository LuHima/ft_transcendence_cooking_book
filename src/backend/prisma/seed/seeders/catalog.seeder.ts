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

async function bulkUpsertTranslations(
  prisma: PrismaClient,
  batch: Array<{
    slug: string;
    translations: Record<'it' | 'en' | 'fr', string>;
  }>,
  translationTable: 'ingredient_translations' | 'tag_translations',
  parentTable: 'ingredients' | 'tags',
  fkColumn: 'ingredient_id' | 'tag_id',
): Promise<void> {
  const slugs: string[] = [];
  const locales: string[] = [];
  const names: string[] = [];

  for (const item of batch) {
    for (const locale of LOCALES) {
      slugs.push(item.slug);
      locales.push(locale);
      names.push(item.translations[locale]);
    }
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO ${translationTable} (${fkColumn}, locale, name)
     SELECT p.id, t.locale, t.name
     FROM UNNEST($1::text[], $2::text[], $3::text[]) AS t(slug, locale, name)
     JOIN ${parentTable} p ON p.slug = t.slug
     ON CONFLICT (${fkColumn}, locale) DO UPDATE
     SET name = EXCLUDED.name`,
    slugs,
    locales,
    names,
  );
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
    await prisma.$executeRawUnsafe(
      `INSERT INTO ingredients (slug, category)
       SELECT t.slug, t.category::"IngredientCategory"
       FROM UNNEST($1::text[], $2::text[]) AS t(slug, category)
       ON CONFLICT (slug) DO UPDATE
       SET category = EXCLUDED.category`,
      batch.map((i) => i.slug),
      batch.map((i) => i.category),
    );

    await bulkUpsertTranslations(
      prisma,
      batch,
      'ingredient_translations',
      'ingredients',
      'ingredient_id',
    );
  }

  for (const batch of chunkArray(tags, CHUNK_SIZE)) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO tags (slug)
       SELECT t.slug
       FROM UNNEST($1::text[]) AS t(slug)
       ON CONFLICT (slug) DO NOTHING`,
      batch.map((t) => t.slug),
    );

    await bulkUpsertTranslations(
      prisma,
      batch,
      'tag_translations',
      'tags',
      'tag_id',
    );
  }

  console.log(
    `[seed:catalog] Bulk-upserted ${ingredients.length} ingredients and ${tags.length} tags.`,
  );
}
