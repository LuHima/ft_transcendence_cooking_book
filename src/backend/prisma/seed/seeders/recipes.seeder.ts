import * as fs from 'fs';
import * as path from 'path';
import {
  MediaType,
  OwnerType,
  Prisma,
  PrismaClient,
  RecipePrivacy,
  TranslationSource,
  TranslationStatus,
  User,
} from '@prisma/client';
import { resolveSeedUploadsDir } from '../config';
import {
  PAGE_TWO_CURATED_RECIPES,
  SHOWCASE_RECIPES,
} from '../data/recipes.data';

export interface SeededRecipeRef {
  id: number;
  key: string;
  user_id: number | null;
  owner_type: OwnerType;
  privacy: RecipePrivacy;
  is_active: boolean;
}

export interface SeedRecipesResult {
  byKey: Record<string, SeededRecipeRef>;
  all: SeededRecipeRef[];
}

const HOUR_MS = 60 * 60 * 1000;

function resolveAssetsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../assets'),
    path.resolve(process.cwd(), 'prisma/seed/assets'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Seed assets directory not found');
}

/**
 * Copies committed `.webp` and `.mp4` seed fixtures into `UPLOADS_DIR/recipes/`.
 */
export function copySeedMediaAssets(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const assetsDir = resolveAssetsDir();
  const targetDir = path.join(resolveSeedUploadsDir(env), 'recipes');
  fs.mkdirSync(targetDir, { recursive: true });

  const files = fs
    .readdirSync(assetsDir)
    .filter((f) => f.endsWith('.webp') || f.endsWith('.mp4'));
  for (const file of files) {
    fs.copyFileSync(path.join(assetsDir, file), path.join(targetDir, file));
  }
  return targetDir;
}

/**
 * Copies a seed asset to a per-recipe unique filename (`r<id>-<asset>`) so
 * unlinking media on one recipe never breaks sibling seeded recipes.
 */
function stageRecipeAsset(
  assetsDir: string,
  targetDir: string,
  recipeId: number,
  assetFilename: string,
): string {
  const uniqueName = `r${recipeId}-${assetFilename}`;
  const srcPath = path.join(assetsDir, assetFilename);
  const destPath = path.join(targetDir, uniqueName);
  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(srcPath, destPath);
  }
  return `/api/media/recipes/${recipeId}/${uniqueName}`;
}

/**
 * Seeds the 20 showcase recipes (newest `created_at` so they appear on Page 1)
 * + 12 curated Page 2 recipes (older `created_at`),
 * staging per-recipe unique local media files under `UPLOADS_DIR/recipes`.
 */
export async function seedRecipes(
  prisma: PrismaClient,
  usersByKey: Record<string, User> = {},
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): Promise<SeedRecipesResult> {
  const assetsDir = resolveAssetsDir();
  const targetDir = path.join(resolveSeedUploadsDir(env), 'recipes');
  fs.mkdirSync(targetDir, { recursive: true });

  const dbIngredients = await prisma.ingredient.findMany({
    select: { id: true, slug: true },
  });
  const ingredientIdBySlug = new Map(dbIngredients.map((i) => [i.slug, i.id]));

  const dbTags = await prisma.tag.findMany({
    select: { id: true, slug: true },
  });
  const tagIdBySlug = new Map(dbTags.map((t) => [t.slug, t.id]));

  // Showcase recipes receive newer timestamps (idx 0..19) than Page 2 curated (idx 24..35)
  const timestampedFixtures = [
    ...SHOWCASE_RECIPES.map((fixture, idx) => ({
      fixture,
      createdAt: new Date(now.getTime() - idx * HOUR_MS),
    })),
    ...PAGE_TWO_CURATED_RECIPES.map((fixture, idx) => ({
      fixture,
      createdAt: new Date(now.getTime() - (24 + idx) * HOUR_MS),
    })),
  ];

  const byKey: Record<string, SeededRecipeRef> = {};
  const all: SeededRecipeRef[] = [];

  for (const { fixture, createdAt } of timestampedFixtures) {
    const authorId = fixture.authorKey
      ? (usersByKey[fixture.authorKey]?.id ?? null)
      : null;

    const created = await prisma.recipe.create({
      data: {
        user_id: authorId,
        owner_type: fixture.ownerType,
        is_active: fixture.isActive,
        privacy: fixture.privacy,
        course: fixture.course,
        difficulty: fixture.difficulty,
        prep_time: fixture.prepTime,
        cook_time: fixture.cookTime,
        total_time: fixture.prepTime + fixture.cookTime,
        servings: fixture.servings,
        source_lang: fixture.sourceLang,
        translation_status: fixture.translationStatus,
        created_at: createdAt,
      },
    });

    const coverUrl = fixture.coverAsset
      ? stageRecipeAsset(assetsDir, targetDir, created.id, fixture.coverAsset)
      : null;
    const videoUrl = fixture.videoAsset
      ? stageRecipeAsset(assetsDir, targetDir, created.id, fixture.videoAsset)
      : null;

    if (coverUrl || videoUrl) {
      await prisma.recipe.update({
        where: { id: created.id },
        data: {
          cover_image_url: coverUrl,
          video_url: videoUrl,
        },
      });
    }

    const localesToCreate: Array<'it' | 'en' | 'fr'> =
      fixture.translationStatus === TranslationStatus.failed
        ? (['it', 'en'] as const).filter(
            (l) => l === fixture.sourceLang || l === 'en',
          )
        : ['it', 'en', 'fr'];
    if (
      fixture.translationStatus === TranslationStatus.failed &&
      !localesToCreate.includes(fixture.sourceLang)
    ) {
      localesToCreate.push(fixture.sourceLang);
    }

    await prisma.recipeTranslation.createMany({
      data: localesToCreate.map((locale) => ({
        recipe_id: created.id,
        locale,
        title: fixture.translations[locale].title,
        description: fixture.translations[locale].description,
        tips: fixture.translations[locale].tips ?? null,
        preservation: fixture.translations[locale].preservation ?? null,
        translation_source:
          locale === fixture.sourceLang
            ? TranslationSource.author_original
            : fixture.translationSource,
      })),
    });

    for (let sIdx = 0; sIdx < fixture.steps.length; sIdx++) {
      const step = fixture.steps[sIdx];
      await prisma.recipeStep.create({
        data: {
          recipe_id: created.id,
          step_number: sIdx + 1,
          duration: step.duration,
          image_url: step.imageAsset
            ? stageRecipeAsset(
                assetsDir,
                targetDir,
                created.id,
                step.imageAsset,
              )
            : null,
          translations: {
            create: (['it', 'en', 'fr'] as const).map((locale) => ({
              locale,
              title: step.translations[locale].title ?? null,
              description: step.translations[locale].description,
            })),
          },
        },
      });
    }

    const validIngredients = fixture.ingredients
      .map((ing) => {
        const ingredientId = ingredientIdBySlug.get(ing.slug);
        if (ingredientId === undefined) return null;
        return {
          recipe_id: created.id,
          ingredient_id: ingredientId,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: (ing.notes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        };
      })
      .filter((i): i is NonNullable<typeof i> => i !== null);

    if (validIngredients.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: validIngredients,
      });
    }

    const validTags = fixture.tagSlugs
      .map((slug) => tagIdBySlug.get(slug))
      .filter((id): id is number => id !== undefined);

    if (validTags.length > 0) {
      await prisma.recipeTag.createMany({
        data: validTags.map((tagId) => ({
          recipe_id: created.id,
          tag_id: tagId,
        })),
      });
    }

    if (fixture.galleryAssets && fixture.galleryAssets.length > 0) {
      await prisma.recipeMedia.createMany({
        data: fixture.galleryAssets.map((asset, order) => ({
          recipe_id: created.id,
          url: stageRecipeAsset(assetsDir, targetDir, created.id, asset),
          media_type: MediaType.image,
          order,
        })),
      });
    }

    const ref: SeededRecipeRef = {
      id: created.id,
      key: fixture.key,
      user_id: created.user_id,
      owner_type: created.owner_type,
      privacy: created.privacy,
      is_active: created.is_active,
    };
    byKey[fixture.key] = ref;
    all.push(ref);
  }

  console.log(
    `[seed:recipes] Seeded ${all.length} recipes with isolated per-recipe media.`,
  );
  return { byKey, all };
}
