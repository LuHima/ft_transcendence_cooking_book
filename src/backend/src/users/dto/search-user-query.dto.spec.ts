import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SearchUserQueryDto,
  UserSortBy,
  SortOrder,
} from './search-user-query.dto';

describe('SearchUserQueryDto', () => {
  it('accepts empty object and provides defaults', async () => {
    const dto = plainToInstance(SearchUserQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.search).toBeUndefined();
    expect(dto.sort_by).toBeUndefined();
    expect(dto.sort_order).toBeUndefined();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('accepts valid search string with at least 2 characters', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { search: 'mario' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.search).toBe('mario');
  });

  it('trims leading and trailing whitespace from search', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { search: '  mario  ' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.search).toBe('mario');
  });

  it('transforms whitespace-only search string to undefined', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { search: '   ' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.search).toBeUndefined();
  });

  it('rejects search string shorter than 2 characters with validation error', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { search: 'm' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('search');
    expect(errors[0].constraints?.minLength).toBe(
      'search query must be at least 2 characters',
    );
  });

  it('rejects search string shorter than 2 characters after trimming', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { search: ' a ' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('search');
    expect(errors[0].constraints?.minLength).toBe(
      'search query must be at least 2 characters',
    );
  });

  it.each([
    UserSortBy.username,
    UserSortBy.recipes_count,
    UserSortBy.created_at,
  ])('accepts valid sort_by enum value %s', async (sortByValue) => {
    const dto = plainToInstance(SearchUserQueryDto, { sort_by: sortByValue });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.sort_by).toBe(sortByValue);
  });

  it.each([SortOrder.asc, SortOrder.desc])(
    'accepts valid sort_order enum value %s',
    async (sortOrderValue) => {
      const dto = plainToInstance(SearchUserQueryDto, {
        sort_order: sortOrderValue,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.sort_order).toBe(sortOrderValue);
    },
  );

  it('rejects invalid sort_by enum value', async () => {
    const dto = plainToInstance(SearchUserQueryDto, {
      sort_by: 'invalid_sort_by',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort_by');
  });

  it('rejects invalid sort_order enum value', async () => {
    const dto = plainToInstance(SearchUserQueryDto, {
      sort_order: 'invalid_sort_order',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort_order');
  });

  it('rejects page less than 1', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('page');
  });

  it('rejects limit greater than 100', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { limit: 101 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });
});
