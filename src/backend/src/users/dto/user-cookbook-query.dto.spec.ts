import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  UserCookbookQueryDto,
  RecipeSortBy,
  RecipeSortOrder,
} from './user-cookbook-query.dto';

describe('UserCookbookQueryDto', () => {
  it('applies defaults page=1, limit=20, sort_by=created_at and allows lang and sort_order to be omitted', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.lang).toBeUndefined();
    expect(dto.sort_by).toBe(RecipeSortBy.created_at);
    expect(dto.sort_order).toBeUndefined();
  });

  it('validates and accepts custom page, limit, and supported lang', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {
      page: '3',
      limit: '50',
      lang: 'fr',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
    expect(dto.lang).toBe('fr');
  });

  it.each([
    RecipeSortBy.created_at,
    RecipeSortBy.total_time,
    RecipeSortBy.difficulty,
    RecipeSortBy.likes_count,
    RecipeSortBy.title,
  ])('accepts valid sort_by value %s', async (sortBy) => {
    const dto = plainToInstance(UserCookbookQueryDto, { sort_by: sortBy });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.sort_by).toBe(sortBy);
  });

  it.each([RecipeSortOrder.asc, RecipeSortOrder.desc])(
    'accepts valid sort_order value %s',
    async (sortOrder) => {
      const dto = plainToInstance(UserCookbookQueryDto, {
        sort_order: sortOrder,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.sort_order).toBe(sortOrder);
    },
  );

  it('rejects invalid sort_by value', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {
      sort_by: 'invalid_sort_by',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort_by');
  });

  it('rejects invalid sort_order value', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {
      sort_order: 'invalid_sort_order',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort_order');
  });

  it('rejects unsupported lang with validation error', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {
      lang: 'es',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lang');
  });

  it('rejects limit > 100 with validation error', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {
      limit: '150',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });
});
