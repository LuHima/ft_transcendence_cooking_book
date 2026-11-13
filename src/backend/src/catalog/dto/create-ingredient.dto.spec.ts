import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IngredientCategory } from '@prisma/client';
import { CreateIngredientDto } from './create-ingredient.dto';

const valid = () => ({
  slug: 'bell_pepper',
  category: IngredientCategory.produce,
  translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
});

describe('CreateIngredientDto', () => {
  it('accepts a valid payload', async () => {
    const dto = plainToInstance(CreateIngredientDto, valid());
    expect(await validate(dto)).toHaveLength(0);
  });

  it('trims whitespace around translated names', async () => {
    const dto = plainToInstance(CreateIngredientDto, {
      ...valid(),
      translations: { it: '  Peperone ', en: 'Bell pepper', fr: 'Poivron' },
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.translations.it).toBe('Peperone');
  });

  it.each(['Bell Pepper', 'bell-pepper', 'bell__pepper', '_pepper', ''])(
    'rejects invalid slug %p',
    async (slug) => {
      const dto = plainToInstance(CreateIngredientDto, { ...valid(), slug });
      const errors = await validate(dto);
      expect(errors.map((e) => e.property)).toContain('slug');
    },
  );

  it('rejects an unknown category', async () => {
    const dto = plainToInstance(CreateIngredientDto, {
      ...valid(),
      category: 'nope',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('category');
  });

  it('rejects a missing translations object', async () => {
    const { translations, ...rest } = valid();
    const dto = plainToInstance(CreateIngredientDto, rest);
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('translations');
  });

  it.each(['it', 'en', 'fr'])('rejects a missing %s translation', async (l) => {
    const translations: Record<string, string> = { ...valid().translations };
    delete translations[l];
    const dto = plainToInstance(CreateIngredientDto, {
      ...valid(),
      translations,
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('translations');
  });

  it('rejects an empty or whitespace-only translation', async () => {
    const dto = plainToInstance(CreateIngredientDto, {
      ...valid(),
      translations: { it: '   ', en: 'Bell pepper', fr: 'Poivron' },
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property)).toContain('translations');
  });
});
