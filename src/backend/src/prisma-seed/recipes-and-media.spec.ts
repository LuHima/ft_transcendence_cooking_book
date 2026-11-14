import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  OwnerType,
  RecipePrivacy,
  TranslationSource,
  TranslationStatus,
} from '@prisma/client';
import { resolveStoredUploadPath } from 'src/common/config/upload-paths';
import { SHOWCASE_RECIPES } from 'prisma/seed/data/recipes.data';
import {
  loadSeedJson,
  type CatalogIngredientSeed,
  type CatalogTagSeed,
} from 'prisma/seed/seeders/catalog.seeder';
import {
  buildGeneratedRecipes,
  copySeedMediaAssets,
} from 'prisma/seed/seeders/recipes.seeder';

describe('Local Protected Media Assets & Hybrid 50-Recipe Dataset (#201)', () => {
  const ingredients = loadSeedJson<CatalogIngredientSeed[]>('ingredients.json');
  const tags = loadSeedJson<CatalogTagSeed[]>('tags.json');
  const generated = buildGeneratedRecipes(ingredients, tags);
  const allRecipes = [...SHOWCASE_RECIPES, ...generated];

  it('produces 50 total recipes (20 showcase + 30 generated) with zero external URLs', () => {
    expect(SHOWCASE_RECIPES).toHaveLength(20);
    expect(generated).toHaveLength(30);
    expect(allRecipes).toHaveLength(50);

    const serialized = JSON.stringify(allRecipes);
    expect(serialized).not.toContain('unsplash.com');
    expect(serialized).not.toContain('youtube.com');
  });

  it('fixes no-cook Tiramisu and aligns step durations with prepTime + cookTime', () => {
    const tiramisu = SHOWCASE_RECIPES.find((r) => r.key === 'tiramisu');
    expect(tiramisu?.cookTime).toBe(0);

    for (const r of allRecipes) {
      const stepSum = r.steps.reduce((acc, s) => acc + s.duration, 0);
      expect(stepSum).toBe(r.prepTime + r.cookTime);
    }
  });

  it('covers platform custody (ex_utente), privacy tiers, suspended recipes, and translation provenance', () => {
    const platformCustody = allRecipes.filter(
      (r) => r.ownerType === OwnerType.platform && r.authorKey === 'ex_utente',
    );
    expect(platformCustody.length).toBeGreaterThanOrEqual(3);
    expect(platformCustody.some((r) => r.key === 'pizzaPlatform')).toBe(true);

    expect(
      allRecipes.some((r) => r.privacy === RecipePrivacy.friends_only),
    ).toBe(true);
    expect(allRecipes.some((r) => r.privacy === RecipePrivacy.private)).toBe(
      true,
    );
    expect(allRecipes.filter((r) => !r.isActive).length).toBeGreaterThanOrEqual(
      2,
    );
    expect(
      allRecipes.some((r) => r.translationStatus === TranslationStatus.failed),
    ).toBe(true);

    const sources = new Set(allRecipes.map((r) => r.translationSource));
    expect(sources.has(TranslationSource.author_original)).toBe(true);
    expect(sources.has(TranslationSource.manual)).toBe(true);
    expect(sources.has(TranslationSource.machine)).toBe(true);
  });

  it('copies local .webp and .mp4 assets into UPLOADS_DIR/recipes and resolves canonical paths', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wecook-assets-'));
    const targetDir = copySeedMediaAssets({ UPLOADS_DIR: tmpDir });

    const files = fs.readdirSync(targetDir);
    expect(files).toContain('seed-cover-1.webp');
    expect(files).toContain('seed-tutorial-1.mp4');
    expect(files).toContain('seed-tutorial-2.mp4');

    // Verify resolveStoredUploadPath compatibility
    const prevUploads = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tmpDir;
    // Direct path check matching upload-paths.ts contract
    expect(fs.existsSync(path.join(targetDir, 'seed-tutorial-1.mp4'))).toBe(
      true,
    );
    expect(
      resolveStoredUploadPath('/api/media/recipes/42/seed-cover-1.webp'),
    ).not.toBeNull();
    process.env.UPLOADS_DIR = prevUploads;

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
