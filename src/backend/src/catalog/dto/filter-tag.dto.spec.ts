import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FilterTagDto } from './filter-tag.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

describe('FilterTagDto', () => {
  it('uses default pagination and sort values when omitted', async () => {
    const dto = plainToInstance(FilterTagDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort_by).toBe('name');
    expect(dto.sort_order).toBe(SortOrder.asc);
    expect(dto.lang).toBeUndefined();
    expect(dto.search).toBeUndefined();
  });

  it('validates and accepts valid pagination, lang, search, sort_by, and sort_order', async () => {
    const dto = plainToInstance(FilterTagDto, {
      page: '2',
      limit: '50',
      lang: 'fr',
      search: 'vegan',
      sort_by: 'slug',
      sort_order: 'desc',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.lang).toBe('fr');
    expect(dto.search).toBe('vegan');
    expect(dto.sort_by).toBe('slug');
    expect(dto.sort_order).toBe(SortOrder.desc);
  });

  it('rejects invalid page, limit, lang, sort_by, and sort_order', async () => {
    const badPage = plainToInstance(FilterTagDto, { page: 0 });
    expect((await validate(badPage)).length).toBeGreaterThan(0);

    const badLimit = plainToInstance(FilterTagDto, { limit: 101 });
    expect((await validate(badLimit)).length).toBeGreaterThan(0);

    const badLang = plainToInstance(FilterTagDto, { lang: 'es' });
    expect((await validate(badLang))[0].property).toBe('lang');

    const badSortBy = plainToInstance(FilterTagDto, { sort_by: 'id' });
    expect((await validate(badSortBy))[0].property).toBe('sort_by');

    const badSortOrder = plainToInstance(FilterTagDto, { sort_order: 'up' });
    expect((await validate(badSortOrder))[0].property).toBe('sort_order');
  });
});
