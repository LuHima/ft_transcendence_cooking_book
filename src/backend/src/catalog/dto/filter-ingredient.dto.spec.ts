import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngredientCategory } from '@prisma/client';
import { FilterIngredientDto } from './filter-ingredient.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

describe('FilterIngredientDto', () => {
  it('allows all optional fields to be omitted and applies pagination/sort defaults', async () => {
    const dto = plainToInstance(FilterIngredientDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort_by).toBe('name');
    expect(dto.sort_order).toBe(SortOrder.asc);
    expect(dto.lang).toBeUndefined();
    expect(dto.category).toBeUndefined();
    expect(dto.search).toBeUndefined();
  });

  it('validates and accepts valid pagination, category, lang, search, sort_by, and sort_order', async () => {
    const dto = plainToInstance(FilterIngredientDto, {
      page: '2',
      limit: '30',
      lang: 'it',
      category: IngredientCategory.dairy_eggs,
      search: 'formaggio',
      sort_by: 'slug',
      sort_order: 'desc',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(30);
    expect(dto.lang).toBe('it');
    expect(dto.category).toBe(IngredientCategory.dairy_eggs);
    expect(dto.search).toBe('formaggio');
    expect(dto.sort_by).toBe('slug');
    expect(dto.sort_order).toBe(SortOrder.desc);
  });

  it('rejects out-of-bounds pagination and invalid sort_by or sort_order', async () => {
    const badPage = plainToInstance(FilterIngredientDto, { page: 0 });
    expect((await validate(badPage)).length).toBeGreaterThan(0);

    const badLimit = plainToInstance(FilterIngredientDto, { limit: 101 });
    expect((await validate(badLimit)).length).toBeGreaterThan(0);

    const badSortBy = plainToInstance(FilterIngredientDto, { sort_by: 'id' });
    expect((await validate(badSortBy))[0].property).toBe('sort_by');

    const badSortOrder = plainToInstance(FilterIngredientDto, {
      sort_order: 'sideways',
    });
    expect((await validate(badSortOrder))[0].property).toBe('sort_order');
  });

  it('rejects invalid category with validation error', async () => {
    const dto = plainToInstance(FilterIngredientDto, {
      category: 'invalid_category',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('category');
  });

  it('rejects invalid lang with validation error', async () => {
    const dto = plainToInstance(FilterIngredientDto, {
      lang: 'es',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lang');
  });
});
