import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngredientCategory } from '@prisma/client';
import { FilterIngredientDto } from './filter-ingredient.dto';

describe('FilterIngredientDto', () => {
  it('allows all fields to be omitted', async () => {
    const dto = plainToInstance(FilterIngredientDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.lang).toBeUndefined();
    expect(dto.category).toBeUndefined();
    expect(dto.search).toBeUndefined();
  });

  it('validates and accepts valid category, lang, and search', async () => {
    const dto = plainToInstance(FilterIngredientDto, {
      lang: 'it',
      category: IngredientCategory.dairy_eggs,
      search: 'formaggio',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.lang).toBe('it');
    expect(dto.category).toBe(IngredientCategory.dairy_eggs);
    expect(dto.search).toBe('formaggio');
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
