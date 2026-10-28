import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchUserQueryDto, UserSort } from './search-user-query.dto';

describe('SearchUserQueryDto', () => {
  it('accepts empty object and provides defaults', async () => {
    const dto = plainToInstance(SearchUserQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.search).toBeUndefined();
    expect(dto.sort).toBeUndefined();
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
    UserSort.username_asc,
    UserSort.username_desc,
    UserSort.recipes_count_desc,
    UserSort.newest,
    UserSort.oldest,
  ])('accepts valid sort enum value %s', async (sortValue) => {
    const dto = plainToInstance(SearchUserQueryDto, { sort: sortValue });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.sort).toBe(sortValue);
  });

  it('rejects invalid sort enum value', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { sort: 'invalid_sort' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort');
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
