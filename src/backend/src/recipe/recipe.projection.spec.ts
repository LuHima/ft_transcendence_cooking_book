import { Test, TestingModule } from '@nestjs/testing';
import {
  RecipeProjection,
  RECIPE_SUMMARY_INCLUDE,
  RECIPE_DETAIL_INCLUDE,
} from './recipe.projection';
import {
  Course,
  IngredientCategory,
  MediaType,
  OwnerType,
  RecipeDifficulty,
  TranslationStatus,
  TranslationSource,
  UnitOfMeasure,
} from '@prisma/client';

describe('RecipeProjection', () => {
  let projection: RecipeProjection;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecipeProjection],
    }).compile();

    projection = module.get<RecipeProjection>(RecipeProjection);
  });

  describe('Prisma Inclusion Contracts', () => {
    it('RECIPE_SUMMARY_INCLUDE returns correct shape without currentUserId', () => {
      const config = RECIPE_SUMMARY_INCLUDE();
      expect(config.translations).toBe(true);
      expect(config.user).toEqual({
        select: { id: true, username: true, avatar_url: true },
      });
      expect(config.recipe_tags).toEqual({
        include: { tag: { include: { translations: true } } },
      });
      expect(config._count).toEqual({
        select: {
          likes: true,
          comments: { where: { is_active: true } },
        },
      });
      expect(config.likes).toBe(false);
    });

    it('RECIPE_SUMMARY_INCLUDE returns correct shape with currentUserId', () => {
      const config = RECIPE_SUMMARY_INCLUDE(42);
      expect(config.likes).toEqual({
        where: { user_id: 42 },
        select: { user_id: true },
      });
    });

    it('RECIPE_DETAIL_INCLUDE returns full inclusion graph', () => {
      const configNoUser = RECIPE_DETAIL_INCLUDE();
      expect(configNoUser.steps).toEqual({
        include: { translations: true },
        orderBy: { step_number: 'asc' },
      });
      expect(configNoUser.recipe_ingredients).toEqual({
        include: {
          ingredient: { include: { translations: true } },
        },
      });
      expect(configNoUser.recipe_tags).toEqual({
        include: { tag: { include: { translations: true } } },
      });
      expect(configNoUser.recipe_media).toEqual({
        orderBy: { order: 'asc' },
      });
      expect(configNoUser.likes).toBe(false);

      const configWithUser = RECIPE_DETAIL_INCLUDE(99);
      expect(configWithUser.likes).toEqual({
        where: { user_id: 99 },
        select: { user_id: true },
      });
    });
  });

  describe('resolveLocale', () => {
    it('normalizes valid supported locales (it, en, fr)', () => {
      expect(projection.resolveLocale('it', 'en')).toBe('it');
      expect(projection.resolveLocale('en', 'it')).toBe('en');
      expect(projection.resolveLocale('fr', 'it')).toBe('fr');
    });

    it('falls back to source_lang when requested locale is unsupported or missing', () => {
      expect(projection.resolveLocale('de', 'it')).toBe('it');
      expect(projection.resolveLocale(undefined, 'it')).toBe('it');
      expect(projection.resolveLocale('', 'fr')).toBe('fr');
    });

    it('defaults to en when both requested locale and source_lang are missing', () => {
      expect(projection.resolveLocale(undefined, undefined)).toBe('en');
    });
  });

  describe('resolveTranslation', () => {
    const translations = [
      { locale: 'it', title: 'Titolo Italiano' },
      { locale: 'en', title: 'English Title' },
      { locale: 'fr', title: 'Titre Français' },
    ];

    it('resolves targetLocale when present', () => {
      const res = projection.resolveTranslation(translations, 'fr', 'it');
      expect(res.locale).toBe('fr');
      expect(res.title).toBe('Titre Français');
    });

    it('falls back to source_lang if targetLocale is not found', () => {
      const partial = [
        { locale: 'it', title: 'Titolo Italiano' },
        { locale: 'en', title: 'English Title' },
      ];
      const res = projection.resolveTranslation(partial, 'fr', 'it');
      expect(res.locale).toBe('it');
    });

    it('falls back to en if neither targetLocale nor source_lang is found', () => {
      const partial = [{ locale: 'en', title: 'English Title' }];
      const res = projection.resolveTranslation(partial, 'de', 'es');
      expect(res.locale).toBe('en');
    });

    it('falls back to translations[0] if none of target, source, or en match', () => {
      const obscure = [{ locale: 'es', title: 'Título Español' }];
      const res = projection.resolveTranslation(obscure, 'de', 'it');
      expect(res.locale).toBe('es');
      expect(res.title).toBe('Título Español');
    });

    it('returns undefined when translations array is empty or undefined', () => {
      expect(projection.resolveTranslation([], 'it', 'en')).toBeUndefined();
      expect(
        projection.resolveTranslation(undefined as any, 'it', 'en'),
      ).toBeUndefined();
    });
  });

  describe('resolveTagTranslations', () => {
    const mockTags = [
      {
        tag: {
          id: 1,
          slug: 'vegetarian',
          translations: [
            { locale: 'it', name: 'Vegetariano' },
            { locale: 'en', name: 'Vegetarian' },
          ],
        },
      },
      {
        tag: {
          id: 2,
          slug: 'gluten-free',
          translations: [{ locale: 'en', name: 'Gluten Free' }],
        },
      },
      {
        tag: {
          id: 3,
          slug: 'quick',
          translations: [],
        },
      },
    ];

    it('maps tags to target locale when available', () => {
      const resolved = projection.resolveTagTranslations(mockTags, 'it', 'it');
      expect(resolved[0]).toEqual({
        id: 1,
        slug: 'vegetarian',
        name: 'Vegetariano',
        resolved_lang: 'it',
      });
    });

    it('falls back to en if target locale is missing', () => {
      const resolved = projection.resolveTagTranslations(mockTags, 'fr', 'fr');
      expect(resolved[1]).toEqual({
        id: 2,
        slug: 'gluten-free',
        name: 'Gluten Free',
        resolved_lang: 'en',
      });
    });

    it('falls back to slug when no translation exists', () => {
      const resolved = projection.resolveTagTranslations(mockTags, 'it', 'it');
      expect(resolved[2]).toEqual({
        id: 3,
        slug: 'quick',
        name: 'quick',
        resolved_lang: 'en',
      });
    });

    it('handles empty or undefined tag arrays safely', () => {
      expect(projection.resolveTagTranslations([], 'it', 'it')).toEqual([]);
      expect(
        projection.resolveTagTranslations(undefined as any, 'it', 'it'),
      ).toEqual([]);
    });
  });

  describe('resolveIngredientNotes', () => {
    it('parses JSON dictionary notes with target locale match', () => {
      const notes = { it: 'tritato finemente', en: 'finely chopped' };
      expect(projection.resolveIngredientNotes(notes, 'it', 'en')).toBe(
        'tritato finemente',
      );
    });

    it('falls back to source_lang in JSON dictionary notes', () => {
      const notes = { it: 'tritato finemente', en: 'finely chopped' };
      expect(projection.resolveIngredientNotes(notes, 'fr', 'it')).toBe(
        'tritato finemente',
      );
    });

    it('falls back to en in JSON dictionary notes', () => {
      const notes = { en: 'finely chopped' };
      expect(projection.resolveIngredientNotes(notes, 'fr', 'it')).toBe(
        'finely chopped',
      );
    });

    it('returns null if JSON dictionary notes have no matching locale', () => {
      const notes = { de: 'fein gehackt' };
      expect(projection.resolveIngredientNotes(notes, 'fr', 'it')).toBeNull();
    });

    it('handles string notes directly', () => {
      expect(projection.resolveIngredientNotes('q.b.', 'it', 'it')).toBe(
        'q.b.',
      );
    });

    it('returns null for null, undefined, or empty notes', () => {
      expect(projection.resolveIngredientNotes(null, 'it', 'it')).toBeNull();
      expect(
        projection.resolveIngredientNotes(undefined, 'it', 'it'),
      ).toBeNull();
    });
  });

  describe('toLocalizedSummary', () => {
    const rawRecipe = {
      id: 10,
      course: Course.first_course,
      difficulty: RecipeDifficulty.easy,
      prep_time: 10,
      cook_time: 15,
      total_time: 25,
      servings: 2,
      source_lang: 'it',
      translation_status: TranslationStatus.completed,
      cover_image_url: '/uploads/cover.webp',
      video_url: null,
      created_at: new Date('2026-10-01T00:00:00Z'),
      updated_at: null,
      user: {
        id: 5,
        username: 'chef_luigi',
        avatar_url: '/uploads/avatars/luigi.webp',
      },
      translations: [
        { locale: 'it', title: 'Pasta al Pomodoro', description: 'Semplice' },
        { locale: 'en', title: 'Tomato Pasta', description: 'Simple' },
      ],
      recipe_tags: [
        {
          tag: {
            id: 1,
            slug: 'vegan',
            translations: [{ locale: 'it', name: 'Vegano' }],
          },
        },
      ],
      _count: { likes: 10, comments: 3 },
      likes: [{ user_id: 42 }],
    };

    it('projects summary card localized in Italian', () => {
      const summary = projection.toLocalizedSummary(rawRecipe, 'it', 42);
      expect(summary.id).toBe(10);
      expect(summary.title).toBe('Pasta al Pomodoro');
      expect(summary.description).toBe('Semplice');
      expect(summary.resolved_lang).toBe('it');
      expect(summary.is_active).toBe(true);
      expect(summary.is_liked).toBe(true);
      expect(summary.likes_count).toBe(10);
      expect(summary.comments_count).toBe(3);
      expect(summary.author).toEqual({
        id: 5,
        username: 'chef_luigi',
        avatar_url: '/uploads/avatars/luigi.webp',
      });
      expect(summary.tags).toEqual([
        { id: 1, slug: 'vegan', name: 'Vegano', resolved_lang: 'it' },
      ]);
    });

    it('calculates is_liked false when currentUserId does not match likes', () => {
      const summary = projection.toLocalizedSummary(rawRecipe, 'it', 999);
      expect(summary.is_liked).toBe(false);
    });

    it('calculates is_liked false when currentUserId is undefined', () => {
      const summary = projection.toLocalizedSummary(rawRecipe, 'it', undefined);
      expect(summary.is_liked).toBe(false);
    });

    it('respects pre-computed is_liked boolean if provided on recipe entity', () => {
      const preLiked = { ...rawRecipe, is_liked: true };
      const summary = projection.toLocalizedSummary(preLiked, 'it', undefined);
      expect(summary.is_liked).toBe(true);
    });

    it('nullifies author when recipe is under platform custody (owner_type: platform)', () => {
      const platformRecipe = {
        ...rawRecipe,
        owner_type: OwnerType.platform,
      };
      const summary = projection.toLocalizedSummary(
        platformRecipe,
        'it',
        undefined,
      );
      expect(summary.author).toBeNull();
    });
  });

  describe('toPaginatedSummaryResponse', () => {
    const rawRecipe = {
      id: 1,
      course: Course.dessert,
      difficulty: RecipeDifficulty.easy,
      prep_time: 5,
      cook_time: 0,
      total_time: 5,
      servings: 1,
      source_lang: 'en',
      translation_status: TranslationStatus.completed,
      cover_image_url: null,
      video_url: null,
      created_at: new Date('2026-10-01T00:00:00Z'),
      updated_at: null,
      user: null,
      translations: [
        { locale: 'en', title: 'Fruit Bowl', description: 'Fresh' },
      ],
      recipe_tags: [],
      _count: { likes: 0, comments: 0 },
      likes: [],
    };

    it('handles empty collection edge case', () => {
      const res = projection.toPaginatedSummaryResponse([], 0, {
        page: 1,
        limit: 20,
      });
      expect(res.items).toEqual([]);
      expect(res.total).toBe(0);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(20);
      expect(res.total_pages).toBe(0);
      expect(res.has_next_page).toBe(false);
      expect(res.has_prev_page).toBe(false);
    });

    it('handles single page collection', () => {
      const res = projection.toPaginatedSummaryResponse([rawRecipe], 1, {
        page: 1,
        limit: 20,
      });
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(20);
      expect(res.total_pages).toBe(1);
      expect(res.has_next_page).toBe(false);
      expect(res.has_prev_page).toBe(false);
    });

    it('handles multi-page pagination math and navigation flags', () => {
      const res = projection.toPaginatedSummaryResponse(
        [rawRecipe, rawRecipe],
        45,
        { page: 2, limit: 10 },
      );
      expect(res.items).toHaveLength(2);
      expect(res.total).toBe(45);
      expect(res.page).toBe(2);
      expect(res.limit).toBe(10);
      expect(res.total_pages).toBe(5);
      expect(res.has_next_page).toBe(true);
      expect(res.has_prev_page).toBe(true);
    });
  });

  describe('toLocalizedDetail', () => {
    const rawDetailRecipe = {
      id: 100,
      course: Course.first_course,
      difficulty: RecipeDifficulty.medium,
      prep_time: 20,
      cook_time: 15,
      total_time: 35,
      servings: 4,
      source_lang: 'it',
      translation_status: TranslationStatus.completed,
      cover_image_url: '/uploads/cover.webp',
      video_url: 'https://youtube.com/watch?v=123',
      created_at: new Date('2026-10-01T00:00:00Z'),
      updated_at: new Date('2026-10-02T00:00:00Z'),
      user: {
        id: 7,
        username: 'gordon',
        avatar_url: '/uploads/avatars/gordon.webp',
      },
      translations: [
        {
          locale: 'it',
          title: 'Risotto ai Funghi',
          description: 'Cremoso',
          preservation: 'Consumare subito',
          tips: 'Mantecare a fuoco spento',
        },
        {
          locale: 'en',
          title: 'Mushroom Risotto',
          description: 'Creamy',
          preservation: 'Eat immediately',
          tips: 'Stir vigorously off heat',
        },
      ],
      steps: [
        {
          id: 202,
          step_number: 2,
          duration: 18,
          image_url: null,
          translations: [
            { locale: 'it', title: 'Cottura', description: 'Aggiungere brodo' },
            { locale: 'en', title: 'Cooking', description: 'Add stock' },
          ],
        },
        {
          id: 201,
          step_number: 1,
          duration: 5,
          image_url: '/uploads/step1.webp',
          translations: [
            {
              locale: 'it',
              title: 'Tostatura',
              description: 'Tostare il riso',
            },
            { locale: 'en', title: 'Toast', description: 'Toast the rice' },
          ],
        },
      ],
      recipe_ingredients: [
        {
          quantity: 320,
          unit: UnitOfMeasure.g,
          notes: {
            it: 'Carnaroli o Vialone Nano',
            en: 'Carnaroli or Arborio',
          },
          ingredient: {
            id: 50,
            slug: 'rice',
            category: IngredientCategory.bakery_grains,
            translations: [
              { locale: 'it', name: 'Riso' },
              { locale: 'en', name: 'Rice' },
            ],
          },
        },
      ],
      recipe_tags: [
        {
          tag: {
            id: 30,
            slug: 'gluten-free',
            translations: [
              { locale: 'it', name: 'Senza Glutine' },
              { locale: 'en', name: 'Gluten Free' },
            ],
          },
        },
      ],
      recipe_media: [
        {
          id: 1,
          url: '/uploads/media1.webp',
          media_type: MediaType.image,
          order: 0,
        },
      ],
      _count: { likes: 25, comments: 5 },
      likes: [{ user_id: 12 }],
    };

    it('correctly maps full detail payload with sorted steps, ingredients, and media', () => {
      const detail = projection.toLocalizedDetail(rawDetailRecipe, 'en', 12);

      expect(detail.id).toBe(100);
      expect(detail.title).toBe('Mushroom Risotto');
      expect(detail.description).toBe('Creamy');
      expect(detail.preservation).toBe('Eat immediately');
      expect(detail.tips).toBe('Stir vigorously off heat');
      expect(detail.resolved_lang).toBe('en');
      expect(detail.is_liked).toBe(true);
      expect(detail.is_active).toBe(true);

      // Verify steps ordering (step 1 then step 2)
      expect(detail.steps).toHaveLength(2);
      expect(detail.steps[0].step_number).toBe(1);
      expect(detail.steps[0].title).toBe('Toast');
      expect(detail.steps[0].description).toBe('Toast the rice');
      expect(detail.steps[1].step_number).toBe(2);
      expect(detail.steps[1].title).toBe('Cooking');
      expect(detail.steps[1].description).toBe('Add stock');

      // Verify ingredients
      expect(detail.ingredients).toHaveLength(1);
      expect(detail.ingredients[0].id).toBe(50);
      expect(detail.ingredients[0].slug).toBe('rice');
      expect(detail.ingredients[0].name).toBe('Rice');
      expect(detail.ingredients[0].notes).toBe('Carnaroli or Arborio');
      expect(detail.ingredients[0].resolved_lang).toBe('en');

      // Verify tags
      expect(detail.tags).toEqual([
        {
          id: 30,
          slug: 'gluten-free',
          name: 'Gluten Free',
          resolved_lang: 'en',
        },
      ]);

      // Verify media
      expect(detail.media).toEqual([
        {
          id: 1,
          url: '/uploads/media1.webp',
          media_type: MediaType.image,
          order: 0,
        },
      ]);
    });

    it('nullifies author when detail recipe is under platform custody', () => {
      const platformDetailRecipe = {
        ...rawDetailRecipe,
        owner_type: OwnerType.platform,
      };
      const detail = projection.toLocalizedDetail(
        platformDetailRecipe,
        'en',
        undefined,
      );
      expect(detail.author).toBeNull();
    });

    it('projects translation_source: author_original when requested in source language and maps available_languages with provenance', () => {
      const recipeWithProvenance = {
        ...rawDetailRecipe,
        source_lang: 'it',
        translations: [
          {
            locale: 'it',
            title: 'Risotto ai Funghi',
            description: 'Cremoso',
            translation_source: TranslationSource.author_original,
          },
          {
            locale: 'en',
            title: 'Mushroom Risotto',
            description: 'Creamy',
            translation_source: TranslationSource.machine,
          },
        ],
      };

      const detail = projection.toLocalizedDetail(recipeWithProvenance, 'it');
      expect(detail.resolved_lang).toBe('it');
      expect(detail.translation_source).toBe(TranslationSource.author_original);
      expect(detail.available_languages).toEqual([
        { locale: 'it', translation_source: TranslationSource.author_original },
        { locale: 'en', translation_source: TranslationSource.machine },
      ]);
    });

    it('projects translation_source: machine for unedited translations and manual for human-edited translations', () => {
      const recipeWithMachine = {
        ...rawDetailRecipe,
        source_lang: 'it',
        translations: [
          {
            locale: 'it',
            title: 'Risotto ai Funghi',
            description: 'Cremoso',
            translation_source: TranslationSource.author_original,
          },
          {
            locale: 'en',
            title: 'Mushroom Risotto',
            description: 'Creamy',
            translation_source: TranslationSource.machine,
          },
        ],
      };

      const machineDetail = projection.toLocalizedDetail(
        recipeWithMachine,
        'en',
      );
      expect(machineDetail.resolved_lang).toBe('en');
      expect(machineDetail.translation_source).toBe(TranslationSource.machine);

      const recipeWithManual = {
        ...rawDetailRecipe,
        source_lang: 'it',
        translations: [
          {
            locale: 'it',
            title: 'Risotto ai Funghi',
            description: 'Cremoso',
            translation_source: TranslationSource.author_original,
          },
          {
            locale: 'en',
            title: 'Artisanal Mushroom Risotto',
            description: 'Hand-crafted description',
            translation_source: TranslationSource.manual,
          },
        ],
      };

      const manualDetail = projection.toLocalizedDetail(recipeWithManual, 'en');
      expect(manualDetail.resolved_lang).toBe('en');
      expect(manualDetail.translation_source).toBe(TranslationSource.manual);
      expect(manualDetail.available_languages).toEqual([
        { locale: 'it', translation_source: TranslationSource.author_original },
        { locale: 'en', translation_source: TranslationSource.manual },
      ]);
    });
  });
});
