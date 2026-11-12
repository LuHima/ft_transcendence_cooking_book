import { Test, TestingModule } from '@nestjs/testing';
import { RecipeService } from './recipe.service';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { RecipeProjection } from './recipe.projection';
import { PrismaService } from '../../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import { ProductionConfig } from '../common/config/production.config';
import { NotificationEmit } from '../notifications/notification-emit';
import {
  Course,
  RecipeDifficulty,
  TranslationSource,
  TranslationStatus,
} from '@prisma/client';
import { RecipeSortBy, RecipeSortOrder } from './dto/filter-recipe.dto';

describe('Advanced Recipe Search & Localized Sorting Integration Suite', () => {
  let service: RecipeService;

  // In-memory relational catalog dataset simulating PostgreSQL database
  const catalog = [
    {
      id: 1,
      is_active: true,
      course: Course.first_course,
      difficulty: RecipeDifficulty.easy,
      prep_time: 10,
      cook_time: 15,
      total_time: 25,
      servings: 2,
      source_lang: 'it',
      translation_status: TranslationStatus.completed,
      created_at: new Date('2026-01-01T10:00:00Z'),
      user: { id: 10, username: 'marco', avatar_url: null },
      translations: [
        {
          locale: 'it',
          title: 'Bruschetta al Pomodoro',
          description: 'Classica bruschetta con pomodorini freschi e basilico.',
          translation_source: TranslationSource.author_original,
        },
        {
          locale: 'en',
          title: 'Tomato Bruschetta',
          description: 'Classic bruschetta with fresh cherry tomatoes and basil.',
          translation_source: TranslationSource.manual,
        },
        {
          locale: 'fr',
          title: 'Bruschetta aux Tomates',
          description: 'Bruschetta classique.',
          translation_source: TranslationSource.machine,
        },
      ],
      recipe_tags: [
        {
          tag_id: 1,
          tag: {
            id: 1,
            slug: 'vegan',
            translations: [{ locale: 'it', name: 'Vegano' }],
          },
        },
        {
          tag_id: 2,
          tag: {
            id: 2,
            slug: 'quick',
            translations: [{ locale: 'it', name: 'Veloce' }],
          },
        },
      ],
      recipe_ingredients: [
        { ingredient_id: 101 }, // Tomato
        { ingredient_id: 102 }, // Basil
      ],
      _count: { likes: 50, comments: 4 },
      likes: [],
    },
    {
      id: 2,
      is_active: true,
      course: Course.main_course,
      difficulty: RecipeDifficulty.hard,
      prep_time: 30,
      cook_time: 90,
      total_time: 120,
      servings: 6,
      source_lang: 'fr',
      translation_status: TranslationStatus.completed,
      created_at: new Date('2026-01-02T10:00:00Z'),
      user: { id: 11, username: 'pierre', avatar_url: null },
      translations: [
        {
          locale: 'fr',
          title: 'Boeuf Bourguignon',
          description: 'Ragoût de boeuf traditionnel au vin rouge.',
          translation_source: TranslationSource.author_original,
        },
        {
          locale: 'en',
          title: 'Beef Bourguignon',
          description: 'Traditional beef stew with red wine.',
          translation_source: TranslationSource.author_original,
        },
      ],
      recipe_tags: [
        {
          tag_id: 3,
          tag: {
            id: 3,
            slug: 'comfort-food',
            translations: [{ locale: 'en', name: 'Comfort Food' }],
          },
        },
      ],
      recipe_ingredients: [
        { ingredient_id: 103 }, // Beef
        { ingredient_id: 104 }, // Red wine
      ],
      _count: { likes: 120, comments: 12 },
      likes: [],
    },
    {
      id: 3,
      is_active: true,
      course: Course.dessert,
      difficulty: RecipeDifficulty.medium,
      prep_time: 20,
      cook_time: 0,
      total_time: 20,
      servings: 4,
      source_lang: 'it',
      translation_status: TranslationStatus.completed,
      created_at: new Date('2026-01-03T10:00:00Z'),
      user: { id: 10, username: 'marco', avatar_url: null },
      translations: [
        {
          locale: 'it',
          title: 'Tiramisù Tradizionale',
          description: 'Il classico dolce al cucchiaio italiano.',
          translation_source: TranslationSource.author_original,
        },
        // No French translation, no English translation (relies on source fallback to 'it')
      ],
      recipe_tags: [
        {
          tag_id: 2,
          tag: {
            id: 2,
            slug: 'quick',
            translations: [{ locale: 'it', name: 'Veloce' }],
          },
        },
        {
          tag_id: 4,
          tag: {
            id: 4,
            slug: 'vegetarian',
            translations: [{ locale: 'it', name: 'Vegetariano' }],
          },
        },
      ],
      recipe_ingredients: [
        { ingredient_id: 105 }, // Mascarpone (Dairy)
        { ingredient_id: 106 }, // Coffee
      ],
      _count: { likes: 95, comments: 8 },
      likes: [],
    },
  ];

  const mockPrisma = {
    $queryRaw: jest.fn(),
    recipe: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        RecipeProjection,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: TranslationService,
          useValue: {
            verifySourceLanguage: jest.fn(),
            translateBatch: jest.fn(),
          },
        },
        {
          provide: ProductionConfig,
          useValue: { isProduction: jest.fn().mockReturnValue(false) },
        },
        {
          provide: NotificationEmit,
          useValue: { notification: jest.fn() },
        },
        {
          provide: ImageProcessingService,
          useValue: { processRecipeImageFile: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<RecipeService>(RecipeService);
  });

  describe('Multi-Criteria Filtering Integration', () => {
    it('filters by duration boundaries: min_time, max_time, max_prep_time', async () => {
      mockPrisma.recipe.findMany.mockImplementation(({ where }) => {
        return catalog.filter((r) => {
          if (where.total_time?.gte !== undefined && r.total_time < where.total_time.gte)
            return false;
          if (where.total_time?.lte !== undefined && r.total_time > where.total_time.lte)
            return false;
          if (where.prep_time?.lte !== undefined && r.prep_time > where.prep_time.lte)
            return false;
          return true;
        });
      });
      mockPrisma.recipe.count.mockResolvedValue(1);

      const result = await service.getAllRecipe({
        min_time: 15,
        max_time: 30,
        max_prep_time: 15,
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(1); // Bruschetta: total_time 25, prep_time 10
    });

    it('filters by original authoring source language (source_lang)', async () => {
      mockPrisma.recipe.findMany.mockImplementation(({ where }) => {
        return catalog.filter((r) => r.source_lang === where.source_lang);
      });
      mockPrisma.recipe.count.mockResolvedValue(1);

      const result = await service.getAllRecipe({ source_lang: 'fr' });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(2); // Boeuf Bourguignon
    });

    it('filters by translation curation (curated_only=true with requested lang)', async () => {
      // In French:
      // Recipe 1 has French machine translation -> rejected by curated_only
      // Recipe 2 has French author_original translation -> matched
      mockPrisma.recipe.findMany.mockImplementation(({ where }) => {
        const curationCondition = where.AND?.find((c: any) => c.translations?.some);
        if (curationCondition) {
          const { locale, translation_source } = curationCondition.translations.some;
          return catalog.filter((r) =>
            r.translations.some(
              (t) =>
                t.locale === locale &&
                translation_source.in.includes(t.translation_source),
            ),
          );
        }
        return catalog;
      });
      mockPrisma.recipe.count.mockResolvedValue(1);

      const result = await service.getAllRecipe({
        curated_only: true,
        lang: 'fr',
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(2); // Boeuf Bourguignon
    });

    it('filters by tag conjunction (tag_mode=all) requiring all tags', async () => {
      mockPrisma.recipe.findMany.mockImplementation(({ where }) => {
        const tagConditions = where.AND?.filter((c: any) => c.recipe_tags?.some?.tag_id !== undefined);
        return catalog.filter((r) => {
          if (!tagConditions || tagConditions.length === 0) return true;
          return tagConditions.every((tc: any) =>
            r.recipe_tags.some((rt) => rt.tag_id === tc.recipe_tags.some.tag_id),
          );
        });
      });
      mockPrisma.recipe.count.mockResolvedValue(1);

      // Recipe 1 has tag 1 (vegan) and tag 2 (quick)
      // Recipe 3 has tag 2 (quick) and tag 4 (vegetarian)
      const result = await service.getAllRecipe({
        tag_ids: [1, 2],
        tag_mode: 'all',
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(1);
    });

    it('filters by tag disjunction (tag_mode=any) matching any tag', async () => {
      mockPrisma.recipe.findMany.mockImplementation(({ where }) => {
        const anyTagCondition = where.AND?.find((c: any) => c.recipe_tags?.some?.tag_id?.in !== undefined);
        return catalog.filter((r) => {
          if (!anyTagCondition) return true;
          const allowedTagIds = anyTagCondition.recipe_tags.some.tag_id.in;
          return r.recipe_tags.some((rt) => allowedTagIds.includes(rt.tag_id));
        });
      });
      mockPrisma.recipe.count.mockResolvedValue(2);

      // Tag 1 (vegan) or Tag 4 (vegetarian) matches Recipe 1 and Recipe 3
      const result = await service.getAllRecipe({
        tag_ids: [1, 4],
        tag_mode: 'any',
      });

      expect(result.items.length).toBe(2);
      expect(result.items.map((i) => i.id).sort()).toEqual([1, 3]);
    });

    it('excludes recipes matching exclude_tag_ids', async () => {
      mockPrisma.recipe.findMany.mockImplementation(({ where }) => {
        const excludeCondition = where.AND?.find((c: any) => c.recipe_tags?.none?.tag_id?.in !== undefined);
        return catalog.filter((r) => {
          if (!excludeCondition) return true;
          const excludedTagIds = excludeCondition.recipe_tags.none.tag_id.in;
          return !r.recipe_tags.some((rt) => excludedTagIds.includes(rt.tag_id));
        });
      });
      mockPrisma.recipe.count.mockResolvedValue(1);

      // Exclude quick recipes (tag 2) leaves only Boeuf Bourguignon (id: 2)
      const result = await service.getAllRecipe({
        exclude_tag_ids: [2],
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(2);
    });

    it('filters by pantry ingredients (ingredient_ids with all) and allergen exclusion', async () => {
      mockPrisma.recipe.findMany.mockImplementation(({ where }) => {
        const ingConditions = where.AND?.filter((c: any) => c.recipe_ingredients?.some?.ingredient_id !== undefined);
        const excludeIng = where.AND?.find((c: any) => c.recipe_ingredients?.none?.ingredient_id?.in !== undefined);

        return catalog.filter((r) => {
          if (ingConditions && ingConditions.length > 0) {
            const hasAll = ingConditions.every((ic: any) =>
              r.recipe_ingredients.some((ri) => ri.ingredient_id === ic.recipe_ingredients.some.ingredient_id),
            );
            if (!hasAll) return false;
          }
          if (excludeIng) {
            const excludedIds = excludeIng.recipe_ingredients.none.ingredient_id.in;
            const hasExcluded = r.recipe_ingredients.some((ri) => excludedIds.includes(ri.ingredient_id));
            if (hasExcluded) return false;
          }
          return true;
        });
      });
      mockPrisma.recipe.count.mockResolvedValue(1);

      // Recipe 1 contains tomato (101) & basil (102). Mascarpone (105) excluded.
      const result = await service.getAllRecipe({
        ingredient_ids: [101, 102],
        ingredient_mode: 'all',
        exclude_ingredient_ids: [105],
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe(1);
    });
  });

  describe('Localized Title Sorting Integration', () => {
    it('executes two-step retrieval for alphabetical title sorting in English with fallbacks', async () => {
      // In English:
      // Recipe 2: 'Beef Bourguignon'
      // Recipe 1: 'Tomato Bruschetta'
      // Recipe 3: Fallback from source_lang 'it' -> 'Tiramisù Tradizionale'
      // Alphabetical order: 'Beef Bourguignon' (2) -> 'Tiramisù Tradizionale' (3) -> 'Tomato Bruschetta' (1)
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 2 }, { id: 3 }, { id: 1 }]);
      mockPrisma.recipe.count.mockResolvedValueOnce(3);
      mockPrisma.recipe.findMany.mockResolvedValueOnce([
        catalog[0], // id 1
        catalog[1], // id 2
        catalog[2], // id 3
      ]);

      const result = await service.getAllRecipe({
        sort_by: RecipeSortBy.title,
        sort_order: RecipeSortOrder.asc,
        lang: 'en',
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result.items.length).toBe(3);
      // Preserves exact SQL ordering: [2, 3, 1]
      expect(result.items[0].id).toBe(2);
      expect(result.items[1].id).toBe(3);
      expect(result.items[2].id).toBe(1);
      expect(result.items[0].title).toBe('Beef Bourguignon');
      expect(result.items[1].title).toBe('Tiramisù Tradizionale');
      expect(result.items[2].title).toBe('Tomato Bruschetta');
    });

    it('executes two-step retrieval for descending title sorting in Italian', async () => {
      // In Italian:
      // Recipe 3: 'Tiramisù Tradizionale' (3)
      // Recipe 1: 'Bruschetta al Pomodoro' (1)
      // Recipe 2: Fallback to source 'Boeuf Bourguignon' or English (2)
      // Descending order: 3 -> 1 -> 2
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 3 }, { id: 1 }, { id: 2 }]);
      mockPrisma.recipe.count.mockResolvedValueOnce(3);
      mockPrisma.recipe.findMany.mockResolvedValueOnce([
        catalog[0],
        catalog[1],
        catalog[2],
      ]);

      const result = await service.getAllRecipe({
        sort_by: RecipeSortBy.title,
        sort_order: RecipeSortOrder.desc,
        lang: 'it',
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      expect(result.items.length).toBe(3);
      expect(result.items[0].id).toBe(3);
      expect(result.items[1].id).toBe(1);
      expect(result.items[2].id).toBe(2);
    });
  });
});
