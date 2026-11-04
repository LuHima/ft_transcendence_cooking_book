import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  FilterRecipeDto,
  RecipeSortBy,
  RecipeSortOrder,
} from './filter-recipe.dto';

describe('FilterRecipeDto', () => {
  it('assigns default values for pagination, modes, and sort_by when an empty object is passed', async () => {
    const dto = plainToInstance(FilterRecipeDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.tag_mode).toBe('all');
    expect(dto.ingredient_mode).toBe('all');
    expect(dto.sort_by).toBe(RecipeSortBy.created_at);
    expect(dto.sort_order).toBeUndefined();
    expect(dto.min_time).toBeUndefined();
    expect(dto.max_prep_time).toBeUndefined();
    expect(dto.max_time).toBeUndefined();
    expect(dto.source_lang).toBeUndefined();
    expect(dto.curated_only).toBeUndefined();
    expect(dto.tag_ids).toBeUndefined();
    expect(dto.exclude_tag_ids).toBeUndefined();
    expect(dto.ingredient_ids).toBeUndefined();
    expect(dto.exclude_ingredient_ids).toBeUndefined();
  });

  describe('Duration parameters', () => {
    it('accepts valid min_time, max_prep_time, and max_time', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        min_time: '15',
        max_prep_time: '10',
        max_time: '60',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.min_time).toBe(15);
      expect(dto.max_prep_time).toBe(10);
      expect(dto.max_time).toBe(60);
    });

    it('accepts zero for duration parameters', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        min_time: 0,
        max_prep_time: 0,
        max_time: 0,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.min_time).toBe(0);
      expect(dto.max_prep_time).toBe(0);
      expect(dto.max_time).toBe(0);
    });

    it('rejects negative numbers for duration parameters', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        min_time: -1,
        max_prep_time: -5,
        max_time: -10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(3);
      const props = errors.map((e) => e.property);
      expect(props).toContain('min_time');
      expect(props).toContain('max_prep_time');
      expect(props).toContain('max_time');
    });

    it('rejects non-integer values for duration parameters', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        min_time: 12.5,
        max_prep_time: 4.2,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(2);
      const props = errors.map((e) => e.property);
      expect(props).toContain('min_time');
      expect(props).toContain('max_prep_time');
    });
  });

  describe('Language and Curation parameters', () => {
    it('accepts valid source_lang codes of length 2 to 5', async () => {
      for (const code of ['it', 'en', 'fr', 'es-ES']) {
        const dto = plainToInstance(FilterRecipeDto, { source_lang: code });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
        expect(dto.source_lang).toBe(code);
      }
    });

    it('rejects source_lang codes with length < 2 or > 5', async () => {
      const dtoShort = plainToInstance(FilterRecipeDto, { source_lang: 'e' });
      const errorsShort = await validate(dtoShort);
      expect(errorsShort.length).toBeGreaterThan(0);
      expect(errorsShort[0].property).toBe('source_lang');

      const dtoLong = plainToInstance(FilterRecipeDto, {
        source_lang: 'en-US-extra',
      });
      const errorsLong = await validate(dtoLong);
      expect(errorsLong.length).toBeGreaterThan(0);
      expect(errorsLong[0].property).toBe('source_lang');
    });

    it('correctly transforms string and boolean representations of curated_only', () => {
      const dtoTrue = plainToInstance(FilterRecipeDto, { curated_only: 'true' });
      expect(dtoTrue.curated_only).toBe(true);

      const dtoFalse = plainToInstance(FilterRecipeDto, {
        curated_only: 'false',
      });
      expect(dtoFalse.curated_only).toBe(false);

      const dtoBool = plainToInstance(FilterRecipeDto, { curated_only: true });
      expect(dtoBool.curated_only).toBe(true);
    });

    it('rejects non-boolean values for curated_only', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        curated_only: 'maybe',
        lang: 'it',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('curated_only');
    });

    it('rejects curated_only=true when lang is not specified', async () => {
      const dto = plainToInstance(FilterRecipeDto, { curated_only: true });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'curated_only')).toBe(true);
    });

    it('accepts curated_only=true when lang is specified', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        curated_only: true,
        lang: 'fr',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.curated_only).toBe(true);
      expect(dto.lang).toBe('fr');
    });

    it('accepts curated_only=false when lang is omitted', async () => {
      const dto = plainToInstance(FilterRecipeDto, { curated_only: false });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.curated_only).toBe(false);
    });
  });

  describe('Tag parameters and Exclusions', () => {
    it.each(['all', 'any'] as const)('accepts tag_mode=%s', async (mode) => {
      const dto = plainToInstance(FilterRecipeDto, { tag_mode: mode });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.tag_mode).toBe(mode);
    });

    it('rejects invalid tag_mode', async () => {
      const dto = plainToInstance(FilterRecipeDto, { tag_mode: 'none' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('tag_mode');
    });

    it('transforms comma-separated strings and arrays for tag_ids and exclude_tag_ids', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        tag_ids: '1, 2, 3',
        exclude_tag_ids: ['4', '5'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.tag_ids).toEqual([1, 2, 3]);
      expect(dto.exclude_tag_ids).toEqual([4, 5]);
    });

    it('rejects non-positive numbers in tag_ids and exclude_tag_ids', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        tag_ids: [0, -1],
        exclude_tag_ids: [0],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const props = errors.map((e) => e.property);
      expect(props).toContain('tag_ids');
      expect(props).toContain('exclude_tag_ids');
    });

    it('rejects overlapping tag_ids and exclude_tag_ids', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        tag_ids: [1, 2, 3],
        exclude_tag_ids: [3, 4],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const props = errors.map((e) => e.property);
      expect(props.includes('tag_ids') || props.includes('exclude_tag_ids')).toBe(
        true,
      );
    });

    it('accepts disjoint tag_ids and exclude_tag_ids', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        tag_ids: [1, 2],
        exclude_tag_ids: [3, 4],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Ingredient parameters and Exclusions', () => {
    it.each(['all', 'any'] as const)(
      'accepts ingredient_mode=%s',
      async (mode) => {
        const dto = plainToInstance(FilterRecipeDto, {
          ingredient_mode: mode,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
        expect(dto.ingredient_mode).toBe(mode);
      },
    );

    it('rejects invalid ingredient_mode', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        ingredient_mode: 'either',
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('ingredient_mode');
    });

    it('transforms comma-separated strings and arrays for ingredient_ids and exclude_ingredient_ids', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        ingredient_ids: '10, 20',
        exclude_ingredient_ids: ['30', '40'],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.ingredient_ids).toEqual([10, 20]);
      expect(dto.exclude_ingredient_ids).toEqual([30, 40]);
    });

    it('rejects non-positive numbers in ingredient_ids and exclude_ingredient_ids', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        ingredient_ids: [-10],
        exclude_ingredient_ids: [0],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const props = errors.map((e) => e.property);
      expect(props).toContain('ingredient_ids');
      expect(props).toContain('exclude_ingredient_ids');
    });

    it('rejects overlapping ingredient_ids and exclude_ingredient_ids', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        ingredient_ids: [10, 20],
        exclude_ingredient_ids: [20, 30],
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const props = errors.map((e) => e.property);
      expect(
        props.includes('ingredient_ids') ||
          props.includes('exclude_ingredient_ids'),
      ).toBe(true);
    });

    it('accepts disjoint ingredient_ids and exclude_ingredient_ids', async () => {
      const dto = plainToInstance(FilterRecipeDto, {
        ingredient_ids: [10, 20],
        exclude_ingredient_ids: [30, 40],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('Sorting parameters', () => {
    it.each([
      RecipeSortBy.created_at,
      RecipeSortBy.total_time,
      RecipeSortBy.difficulty,
      RecipeSortBy.likes_count,
      RecipeSortBy.title,
    ])('accepts sort_by=%s', async (field) => {
      const dto = plainToInstance(FilterRecipeDto, { sort_by: field });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.sort_by).toBe(field);
    });

    it('rejects invalid sort_by value', async () => {
      const dto = plainToInstance(FilterRecipeDto, { sort_by: 'calories' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sort_by');
    });

    it.each([RecipeSortOrder.asc, RecipeSortOrder.desc])(
      'accepts sort_order=%s',
      async (order) => {
        const dto = plainToInstance(FilterRecipeDto, { sort_order: order });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
        expect(dto.sort_order).toBe(order);
      },
    );

    it('rejects invalid sort_order value', async () => {
      const dto = plainToInstance(FilterRecipeDto, { sort_order: 'upward' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('sort_order');
    });
  });
});
