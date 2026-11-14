import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngredientCategory } from '@prisma/client';
import { AdminIngredientQueryDto } from './admin-ingredient-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

describe('AdminIngredientQueryDto', () => {
  it('uses default values when omitted', async () => {
    const dto = plainToInstance(AdminIngredientQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort_by).toBe('id');
    expect(dto.sort_order).toBe(SortOrder.asc);
    expect(dto.category).toBeUndefined();
    expect(dto.search).toBeUndefined();
  });

  it('accepts valid pagination, category, search, sort_by, and sort_order', async () => {
    const dto = plainToInstance(AdminIngredientQueryDto, {
      page: '2',
      limit: '50',
      category: IngredientCategory.dairy_eggs,
      search: 'formaggio',
      sort_by: 'slug',
      sort_order: 'desc',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.category).toBe(IngredientCategory.dairy_eggs);
    expect(dto.search).toBe('formaggio');
    expect(dto.sort_by).toBe('slug');
    expect(dto.sort_order).toBe(SortOrder.desc);
  });

  it('rejects page < 1 and limit > 100 or < 1', async () => {
    const badPage = plainToInstance(AdminIngredientQueryDto, { page: 0 });
    expect((await validate(badPage)).length).toBeGreaterThan(0);

    const badLimitLow = plainToInstance(AdminIngredientQueryDto, { limit: 0 });
    expect((await validate(badLimitLow)).length).toBeGreaterThan(0);

    const badLimitHigh = plainToInstance(AdminIngredientQueryDto, {
      limit: 101,
    });
    expect((await validate(badLimitHigh)).length).toBeGreaterThan(0);
  });

  it('rejects invalid category, sort_by, and sort_order', async () => {
    const badCategory = plainToInstance(AdminIngredientQueryDto, {
      category: 'invalid',
    });
    expect((await validate(badCategory))[0].property).toBe('category');

    const badSortBy = plainToInstance(AdminIngredientQueryDto, {
      sort_by: 'name',
    });
    expect((await validate(badSortBy))[0].property).toBe('sort_by');

    const badSortOrder = plainToInstance(AdminIngredientQueryDto, {
      sort_order: 'random',
    });
    expect((await validate(badSortOrder))[0].property).toBe('sort_order');
  });
});
