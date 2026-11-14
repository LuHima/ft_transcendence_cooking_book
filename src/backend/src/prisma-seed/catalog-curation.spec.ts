import { IngredientCategory } from '@prisma/client';
import {
  curateOpenFoodFactsIngredients,
  FAT_AND_SPREAD_NOISE_REGEX,
  FOOD_LABEL_NOISE_REGEX,
  hasValidMultilingualNames,
  isAdditiveOrIndustrial,
  isCulinaryAllowlisted,
  mapOffCategory,
  normalizeSlug,
} from 'prisma/seed/scripts/curate-off-ingredients';
import {
  loadSeedJson,
  seedCatalog,
  type CatalogIngredientSeed,
  type CatalogTagSeed,
} from 'prisma/seed/seeders/catalog.seeder';

describe('Open Food Facts Catalog Curation & Bulk Upsert (#199)', () => {
  describe('normalizeSlug', () => {
    it('strips language prefixes, accents, and non-alphanumeric characters', () => {
      expect(normalizeSlug('en:Crème Fraîche (30%)')).toBe('creme-fraiche-30');
      expect(normalizeSlug('fr:Pâte_feuilletée')).toBe('pate-feuilletee');
    });
  });

  describe('hasValidMultilingualNames', () => {
    it('accepts valid it/en/fr translations', () => {
      expect(
        hasValidMultilingualNames({
          it: 'Pomodoro',
          en: 'Tomato',
          fr: 'Tomate',
        }),
      ).toBe(true);
    });

    it('rejects missing locales, placeholders, or overly long names', () => {
      expect(hasValidMultilingualNames({ it: 'Pomodoro', en: 'Tomato' })).toBe(
        false,
      );
      expect(
        hasValidMultilingualNames({
          it: 'xx:tomato',
          en: 'Tomato',
          fr: 'Tomate',
        }),
      ).toBe(false);
      expect(
        hasValidMultilingualNames({
          it: 'A'.repeat(101),
          en: 'Tomato',
          fr: 'Tomate',
        }),
      ).toBe(false);
    });
  });

  describe('isAdditiveOrIndustrial', () => {
    it('filters E-numbers, additive metadata, and industrial emulsifiers', () => {
      expect(
        isAdditiveOrIndustrial(
          'en:e300',
          { mandatory_additive_class: { en: 'en:antioxidant' } },
          {
            it: 'Acido ascorbico',
            en: 'Ascorbic acid',
            fr: 'Acide ascorbique',
          },
        ),
      ).toBe(true);

      expect(
        isAdditiveOrIndustrial(
          'en:xanthan-gum',
          {},
          { it: 'Gomma xantana', en: 'Xanthan gum', fr: 'Gomme xanthane' },
        ),
      ).toBe(true);

      expect(
        isAdditiveOrIndustrial(
          'en:basil',
          {},
          { it: 'Basilico', en: 'Basil', fr: 'Basilic' },
        ),
      ).toBe(false);
    });

    it('rejects fat-percentage butter, spreads, and industrial food-label noise (#204)', () => {
      const rejectedSamples = [
        '80% fat salted butter',
        '82% fat unsalted easy-to-spread butter',
        'CI Natural Green 3',
        'Beetroot juice concentrate',
        'Caramel chocolate preparation',
        'Blend of EU honeys',
        'Aniseed aroma',
        'Chicken egg yolk powder',
        'Beef meat extract',
      ];

      for (const sample of rejectedSamples) {
        expect(
          isAdditiveOrIndustrial(
            `en:${normalizeSlug(sample)}`,
            {},
            { it: sample, en: sample, fr: sample },
          ),
        ).toBe(true);
      }
    });

    it('preserves clean culinary staples, powders, extracts, and dark chocolate (#204)', () => {
      const preservedSamples = [
        'Butter',
        'Salted butter',
        'Baking powder',
        'Cocoa Powder',
        'Vanilla Extract',
        'Dark Chocolate (70%)',
      ];

      for (const sample of preservedSamples) {
        expect(
          isAdditiveOrIndustrial(
            `en:${normalizeSlug(sample)}`,
            {},
            { it: sample, en: sample, fr: sample },
          ),
        ).toBe(false);
      }
    });
  });

  describe('mapOffCategory', () => {
    it('maps culinary items to valid schema IngredientCategory values', () => {
      expect(
        mapOffCategory(
          'en:mozzarella',
          { ecobalyse_category: { en: 'dairy' } },
          { it: 'Mozzarella', en: 'Mozzarella', fr: 'Mozzarella' },
        ),
      ).toBe(IngredientCategory.dairy_eggs);

      expect(
        mapOffCategory(
          'en:salmon',
          {},
          { it: 'Salmone', en: 'Salmon', fr: 'Saumon' },
        ),
      ).toBe(IngredientCategory.seafood);
    });
  });

  describe('curateOpenFoodFactsIngredients', () => {
    it('preserves baseline items and deduplicates collisions', () => {
      const baseline: CatalogIngredientSeed[] = [
        {
          slug: 'tomato',
          category: IngredientCategory.produce,
          translations: { it: 'Pomodoro', en: 'Tomato', fr: 'Tomate' },
        },
      ];

      const raw = {
        'en:tomato': {
          name: { it: 'Pomodoro', en: 'Tomato', fr: 'Tomate' },
        },
        'en:e471': {
          e_number: { en: '471' },
          name: { it: 'E471', en: 'E471', fr: 'E471' },
        },
        'en:ricotta': {
          name: { it: 'Ricotta', en: 'Ricotta', fr: 'Ricotta' },
          ecobalyse_category: { en: 'dairy' },
        },
      };

      const curated = curateOpenFoodFactsIngredients(raw, baseline, 10);
      expect(curated).toHaveLength(2);
      expect(curated[0].slug).toBe('tomato');
      expect(curated[1].slug).toBe('ricotta');
      expect(curated[1].category).toBe(IngredientCategory.dairy_eggs);
    });
  });

  describe('committed catalog datasets', () => {
    const ingredients =
      loadSeedJson<CatalogIngredientSeed[]>('ingredients.json');
    const tags = loadSeedJson<CatalogTagSeed[]>('tags.json');
    const validCategories = new Set(Object.values(IngredientCategory));

    it('contains ~3,000 unique ingredients with complete it/en/fr translations and valid categories', () => {
      expect(ingredients.length).toBeGreaterThanOrEqual(2800);
      const slugs = new Set<string>();
      for (const item of ingredients) {
        expect(item.slug).toMatch(/^[a-z0-9_-]+$/);
        expect(item.slug.length).toBeLessThanOrEqual(100);
        expect(slugs.has(item.slug)).toBe(false);
        slugs.add(item.slug);
        expect(validCategories.has(item.category)).toBe(true);
        expect(item.translations.it.trim().length).toBeGreaterThan(0);
        expect(item.translations.en.trim().length).toBeGreaterThan(0);
        expect(item.translations.fr.trim().length).toBeGreaterThan(0);

        if (!isCulinaryAllowlisted(item.translations.en)) {
          const combined =
            `${item.slug} ${item.translations.en} ${item.translations.it} ${item.translations.fr}`.toLowerCase();
          expect(FAT_AND_SPREAD_NOISE_REGEX.test(combined)).toBe(false);
          expect(FOOD_LABEL_NOISE_REGEX.test(combined)).toBe(false);
        }
      }
      // Spot-check baseline slugs preserved
      expect(slugs.has('tomato')).toBe(true);
      expect(slugs.has('guanciale')).toBe(true);
      expect(slugs.has('olive-oil')).toBe(true);
      expect(slugs.has('dark_chocolate')).toBe(true);
      expect(slugs.has('butter')).toBe(true);
      expect(slugs.has('salted-butter')).toBe(true);
    });

    it('contains curated tags with complete it/en/fr translations', () => {
      expect(tags.length).toBeGreaterThanOrEqual(12);
      for (const tag of tags) {
        expect(tag.slug.length).toBeGreaterThan(0);
        expect(tag.translations.it.trim().length).toBeGreaterThan(0);
        expect(tag.translations.en.trim().length).toBeGreaterThan(0);
        expect(tag.translations.fr.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('seedCatalog bulk SQL execution', () => {
    it('executes chunked parameterized UNNEST upserts for ingredients and tags', async () => {
      const mockPrisma = {
        $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      };

      await seedCatalog(mockPrisma as any);
      // 3000 ingredients in batches of 1000 => 3 ingredient + 3 translation queries = 6
      // 12 tags in 1 batch => 1 tag + 1 translation query = 2
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(8);
    });
  });
});
