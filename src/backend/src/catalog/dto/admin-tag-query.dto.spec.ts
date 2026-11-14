import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminTagQueryDto } from './admin-tag-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

describe('AdminTagQueryDto', () => {
  it('uses default values when omitted', async () => {
    const dto = plainToInstance(AdminTagQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort_by).toBe('id');
    expect(dto.sort_order).toBe(SortOrder.asc);
    expect(dto.search).toBeUndefined();
  });

  it('accepts valid pagination, search, sort_by, and sort_order', async () => {
    const dto = plainToInstance(AdminTagQueryDto, {
      page: '3',
      limit: '10',
      search: 'vegan',
      sort_by: 'slug',
      sort_order: 'desc',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(10);
    expect(dto.search).toBe('vegan');
    expect(dto.sort_by).toBe('slug');
    expect(dto.sort_order).toBe(SortOrder.desc);
  });

  it('rejects page < 1 and limit > 100 or < 1', async () => {
    const badPage = plainToInstance(AdminTagQueryDto, { page: 0 });
    expect((await validate(badPage)).length).toBeGreaterThan(0);

    const badLimitLow = plainToInstance(AdminTagQueryDto, { limit: 0 });
    expect((await validate(badLimitLow)).length).toBeGreaterThan(0);

    const badLimitHigh = plainToInstance(AdminTagQueryDto, { limit: 101 });
    expect((await validate(badLimitHigh)).length).toBeGreaterThan(0);
  });

  it('rejects invalid sort_by and sort_order', async () => {
    const badSortBy = plainToInstance(AdminTagQueryDto, { sort_by: 'name' });
    expect((await validate(badSortBy))[0].property).toBe('sort_by');

    const badSortOrder = plainToInstance(AdminTagQueryDto, {
      sort_order: 'invalid',
    });
    expect((await validate(badSortOrder))[0].property).toBe('sort_order');
  });
});
