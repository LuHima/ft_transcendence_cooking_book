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
import { SEED_COUNTS } from 'prisma/seed/config';
import {
  PAGE_TWO_CURATED_RECIPES,
  SHOWCASE_RECIPES,
} from 'prisma/seed/data/recipes.data';
import { copySeedMediaAssets } from 'prisma/seed/seeders/recipes.seeder';

describe('Local Protected Media Assets & 32-Recipe Curated Dataset (#206)', () => {
  const allRecipes = [...SHOWCASE_RECIPES, ...PAGE_TWO_CURATED_RECIPES];

  it('produces 32 curated recipes (20 showcase + 12 page-2) with zero clones or external URLs', () => {
    expect(SHOWCASE_RECIPES).toHaveLength(SEED_COUNTS.SHOWCASE_RECIPES);
    expect(PAGE_TWO_CURATED_RECIPES).toHaveLength(SEED_COUNTS.PAGE_TWO_RECIPES);
    expect(allRecipes).toHaveLength(SEED_COUNTS.TOTAL_RECIPES);

    const keys = new Set(allRecipes.map((r) => r.key));
    expect(keys.size).toBe(SEED_COUNTS.TOTAL_RECIPES);

    for (const r of allRecipes) {
      expect(r.translations.en.title).not.toMatch(/#\d+$/);
      expect(r.translations.it.title).not.toMatch(/#\d+$/);
      expect(r.translations.fr.title).not.toMatch(/#\d+$/);
      expect(r.coverAsset).toBeDefined();
      expect(r.coverAsset).not.toMatch(/^seed-cover-/);
    }

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
    expect(files).toContain('carbonara.webp');
    expect(files).toContain('caprese.webp');
    expect(files).toContain('seed-tutorial-1.mp4');
    expect(files).toContain('seed-tutorial-2.mp4');

    for (const r of allRecipes) {
      expect(r.coverAsset).toBeDefined();
      const assetPath = path.join(targetDir, r.coverAsset!);
      expect(fs.existsSync(assetPath)).toBe(true);
      expect(fs.statSync(assetPath).size).toBeGreaterThan(2048);
    }

    // Verify resolveStoredUploadPath compatibility
    const prevUploads = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tmpDir;
    // Direct path check matching upload-paths.ts contract
    expect(fs.existsSync(path.join(targetDir, 'seed-tutorial-1.mp4'))).toBe(
      true,
    );
    expect(
      resolveStoredUploadPath('/api/media/recipes/42/carbonara.webp'),
    ).not.toBeNull();
    process.env.UPLOADS_DIR = prevUploads;

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
