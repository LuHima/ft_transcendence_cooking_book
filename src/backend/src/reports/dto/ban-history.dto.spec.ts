import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BanHistoryQueryDto } from './ban-history.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

describe('BanHistoryQueryDto', () => {
  it('uses default values when omitted', async () => {
    const dto = plainToInstance(BanHistoryQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort_order).toBe(SortOrder.desc);
  });

  it('accepts valid page, limit, and sort_order', async () => {
    const dto = plainToInstance(BanHistoryQueryDto, {
      page: '2',
      limit: '50',
      sort_order: 'asc',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.sort_order).toBe(SortOrder.asc);
  });

  it('rejects out-of-range page and limit and invalid sort_order', async () => {
    const badPage = plainToInstance(BanHistoryQueryDto, { page: 0 });
    expect((await validate(badPage)).length).toBeGreaterThan(0);

    const badLimit = plainToInstance(BanHistoryQueryDto, { limit: 101 });
    expect((await validate(badLimit)).length).toBeGreaterThan(0);

    const badSort = plainToInstance(BanHistoryQueryDto, {
      sort_order: 'invalid',
    });
    expect((await validate(badSort))[0].property).toBe('sort_order');
  });
});
