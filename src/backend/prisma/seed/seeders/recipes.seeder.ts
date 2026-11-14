import * as fs from 'fs';
import * as path from 'path';
import {
  Course,
  MediaType,
  OwnerType,
  PrismaClient,
  RecipeDifficulty,
  RecipePrivacy,
  TranslationSource,
  TranslationStatus,
  UnitOfMeasure,
  User,
} from '@prisma/client';
import {
  SHOWCASE_RECIPES,
  type SeedRecipeFixture,
} from '../data/recipes.data';
import {
  loadSeedJson,
  type CatalogIngredientSeed,
  type CatalogTagSeed,
} from './catalog.seeder';

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

export function resolveSeedUploadsDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.UPLOADS_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), 'uploads');
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
 * Deterministic Mulberry32 PRNG for reproducible paginated recipe generation.
 */
function createPrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministically builds 30 additional recipes covering all privacy tiers,
 * suspension states, and translation provenance combinations.
 */
export function buildGeneratedRecipes(
  ingredientsCatalog: CatalogIngredientSeed[],
  tagsCatalog: CatalogTagSeed[],
): SeedRecipeFixture[] {
  const rand = createPrng(422026);
  const courses = Object.values(Course);
  const difficulties = Object.values(RecipeDifficulty);
  const units = [
    UnitOfMeasure.g,
    UnitOfMeasure.ml,
    UnitOfMeasure.tbsp,
    UnitOfMeasure.tsp,
    UnitOfMeasure.piece,
  ];
  const coverAssets = [
    'seed-cover-1.webp',
    'seed-cover-2.webp',
    'seed-cover-3.webp',
    'seed-cover-4.webp',
  ];
  const stepAssets = ['seed-step-1.webp', 'seed-step-2.webp'];
  const sourceLangs = ['it', 'en', 'fr'] as const;

  // Accepted friends of mario_bianchi vs non-friends for friends_only testing
  const friendAuthorKeys = [
    'giuly_cooks',
    'chef_marco',
    'sophie_pastry',
    'kenji_noodles',
  ];
  const nonFriendAuthorKeys = [
    'demo_cook_14',
    'demo_cook_15',
    'repeat_offender_active',
  ];
  const generalAuthorKeys = [
    'mario_bianchi',
    'giuly_cooks',
    'chef_marco',
    'sophie_pastry',
    'kenji_noodles',
    'elena_vegan',
    'carlos_mex',
    'demo_cook_01',
    'demo_cook_02',
    'demo_cook_03',
    'demo_cook_04',
    'demo_cook_05',
  ];

  const dishes = [
    { it: 'Zuppa Rustica', en: 'Rustic Soup', fr: 'Soupe Rustique' },
    { it: 'Pasta al Forno', en: 'Baked Pasta', fr: 'Pâtes au Four' },
    { it: 'Insalata Mediterranea', en: 'Mediterranean Salad', fr: 'Salade Méditerranéenne' },
    { it: 'Pollo alle Erbe', en: 'Herb Roasted Chicken', fr: 'Poulet aux Herbes' },
    { it: 'Torta Salata', en: 'Savory Tart', fr: 'Tarte Salée' },
    { it: 'Risotto Cremoso', en: 'Creamy Risotto', fr: 'Risotto Crémeux' },
    { it: 'Crema di Verdure', en: 'Velvety Vegetable Soup', fr: 'Velouté de Légumes' },
    { it: 'Biscotti Speziati', en: 'Spiced Cookies', fr: 'Biscuits Épicés' },
    { it: 'Frittata alle Verdure', en: 'Garden Frittata', fr: 'Frittata aux Légumes' },
    { it: 'Filetto al Limone', en: 'Lemon Glazed Fillet', fr: 'Filet au Citron' },
  ];

  const generated: SeedRecipeFixture[] = [];

  for (let i = 0; i < 30; i++) {
    const num = i + 1;
    const key = `generated_recipe_${num.toString().padStart(2, '0')}`;

    let privacy: RecipePrivacy = RecipePrivacy.public;
    let authorKey = generalAuthorKeys[i % generalAuthorKeys.length];
    let isActive = true;
    let translationStatus: TranslationStatus = TranslationStatus.completed;
    let translationSource: TranslationSource =
      i % 3 === 0
        ? TranslationSource.author_original
        : i % 3 === 1
          ? TranslationSource.manual
          : TranslationSource.machine;

    // 8 friends_only (4 by friends of mario_bianchi, 4 by non-friends)
    if (i >= 16 && i < 20) {
      privacy = RecipePrivacy.friends_only;
      authorKey = friendAuthorKeys[(i - 16) % friendAuthorKeys.length];
    } else if (i >= 20 && i < 24) {
      privacy = RecipePrivacy.friends_only;
      authorKey = nonFriendAuthorKeys[(i - 20) % nonFriendAuthorKeys.length];
    } else if (i >= 24 && i < 28) {
      // 4 private recipes (including i=24 for reported private inspection)
      privacy = RecipePrivacy.private;
      authorKey = i === 24 ? 'demo_cook_14' : generalAuthorKeys[i % generalAuthorKeys.length];
    } else if (i >= 28) {
      // 2 suspended recipes (is_active: false)
      isActive = false;
      authorKey = i === 28 ? 'repeat_offender_active' : 'demo_cook_13';
    }

    if (i === 15) {
      translationStatus = TranslationStatus.failed;
    }

    const prepTime = 10 + Math.floor(rand() * 20);
    const cookTime = 10 + Math.floor(rand() * 35);
    const totalTime = prepTime + cookTime;
    const step1Dur = Math.floor(totalTime / 2);
    const step2Dur = totalTime - step1Dur;

    const dish = dishes[i % dishes.length];
    const pickedIngredients: SeedRecipeFixture['ingredients'] = [];
    const usedSlugs = new Set<string>();
    while (pickedIngredients.length < 4) {
      const idx = Math.floor(rand() * ingredientsCatalog.length);
      const ing = ingredientsCatalog[idx];
      if (!usedSlugs.has(ing.slug)) {
        usedSlugs.add(ing.slug);
        pickedIngredients.push({
          slug: ing.slug,
          quantity: 50 + Math.floor(rand() * 250),
          unit: units[Math.floor(rand() * units.length)],
        });
      }
    }

    const tag1 = tagsCatalog[i % tagsCatalog.length].slug;
    const tag2 = tagsCatalog[(i + 3) % tagsCatalog.length].slug;
    const tagSlugs = tag1 === tag2 ? [tag1] : [tag1, tag2];

    generated.push({
      key,
      authorKey,
      ownerType: OwnerType.user,
      privacy,
      isActive,
      sourceLang: sourceLangs[i % sourceLangs.length],
      translationStatus,
      translationSource,
      course: courses[i % courses.length],
      difficulty: difficulties[i % difficulties.length],
      prepTime,
      cookTime,
      servings: 2 + (i % 5),
      coverAsset: coverAssets[i % coverAssets.length],
      videoAsset: i % 10 === 0 ? 'seed-tutorial-1.mp4' : undefined,
      galleryAssets: i % 5 === 0 ? ['seed-gallery-1.webp'] : undefined,
      tagSlugs,
      translations: {
        it: {
          title: `${dish.it} #${num}`,
          description: `Preparazione casalinga di ${dish.it.toLowerCase()} con ingredienti selezionati.`,
        },
        en: {
          title: `${dish.en} #${num}`,
          description: `Homemade ${dish.en.toLowerCase()} prepared with fresh pantry ingredients.`,
        },
        fr: {
          title: `${dish.fr} #${num}`,
          description: `Recette maison de ${dish.fr.toLowerCase()} avec des ingrédients sélectionnés.`,
        },
      },
      steps: [
        {
          duration: step1Dur,
          imageAsset: stepAssets[i % stepAssets.length],
          translations: {
            it: { title: 'Preparazione', description: 'Preparare e pesare tutti gli ingredienti.' },
            en: { title: 'Prep', description: 'Prepare and measure all ingredients.' },
            fr: { title: 'Préparation', description: 'Préparer et peser tous les ingrédients.' },
          },
        },
        {
          duration: step2Dur,
          translations: {
            it: { title: 'Cottura', description: 'Cuocere fino a doratura e servire caldo.' },
            en: { title: 'Cook', description: 'Cook until golden and serve warm.' },
            fr: { title: 'Cuisson', description: 'Cuire jusqu’à coloration et servir chaud.' },
          },
        },
      ],
      ingredients: pickedIngredients,
    });
  }

  return generated;
}

/**
 * Seeds the 20 showcase recipes + 30 deterministic generated recipes,
 * copying local `.webp`/`.mp4` assets into `UPLOADS_DIR/recipes` and
 * persisting canonical `/api/media/recipes/:recipeId/:filename` paths.
 */
export async function seedRecipes(
  prisma: PrismaClient,
  usersByKey: Record<string, User> = {},
  env: NodeJS.ProcessEnv = process.env,
): Promise<SeedRecipesResult> {
  copySeedMediaAssets(env);

  const ingredientsCatalog =
    loadSeedJson<CatalogIngredientSeed[]>('ingredients.json');
  const tagsCatalog = loadSeedJson<CatalogTagSeed[]>('tags.json');

  const dbIngredients = await prisma.ingredient.findMany({
    select: { id: true, slug: true },
  });
  const ingredientIdBySlug = new Map(dbIngredients.map((i) => [i.slug, i.id]));

  const dbTags = await prisma.tag.findMany({
    select: { id: true, slug: true },
  });
  const tagIdBySlug = new Map(dbTags.map((t) => [t.slug, t.id]));

  const allFixtures: SeedRecipeFixture[] = [
    ...SHOWCASE_RECIPES,
    ...buildGeneratedRecipes(ingredientsCatalog, tagsCatalog),
  ];

  const byKey: Record<string, SeededRecipeRef> = {};
  const all: SeededRecipeRef[] = [];

  for (const fixture of allFixtures) {
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
      },
    });

    const coverUrl = fixture.coverAsset
      ? `/api/media/recipes/${created.id}/${fixture.coverAsset}`
      : null;
    const videoUrl = fixture.videoAsset
      ? `/api/media/recipes/${created.id}/${fixture.videoAsset}`
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
            ? `/api/media/recipes/${created.id}/${step.imageAsset}`
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
      .map((ing) => ({
        ingredient_id: ingredientIdBySlug.get(ing.slug),
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes ?? undefined,
      }))
      .filter((i): i is { ingredient_id: number; quantity: number; unit: UnitOfMeasure; notes: any } => i.ingredient_id !== undefined);

    if (validIngredients.length > 0) {
      await prisma.recipeIngredient.createMany({
        data: validIngredients.map((ing) => ({
          recipe_id: created.id,
          ingredient_id: ing.ingredient_id,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.notes,
        })),
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
          url: `/api/media/recipes/${created.id}/${asset}`,
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

  console.log(`[seed:recipes] Seeded ${all.length} recipes with local protected media.`);
  return { byKey, all };
}
