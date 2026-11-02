import { UpdateIngredientDto } from './update-ingredient.dto'
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('UpdateIngredientDto', () => {
  const validPayload = {
    translations: {
      it: 'Senza glutine',
      en: 'Gluten free',
      fr: 'Sans gluten',
    },
  };

  const getErrors = async (payload: unknown) => {
    const dto = plainToInstance(UpdateIngredientDto, payload);
    return validate(dto);
  };

  describe('valid payloads', () => {
    it('accepts a fully valid payload', async () => {
      const errors = await getErrors(validPayload);
      expect(errors).toHaveLength(0);
    });

    it('accepts translations with internal spaces', async () => {
      const errors = await getErrors({
        translations: {
          it: 'Senza glutine',
          en: 'Gluten free',
          fr: 'Sans gluten',
        },
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid translations', () => {
    it('rejects a missing translations object', async () => {
      const errors = await getErrors({});
      expect(errors.some((e) => e.property === 'translations')).toBe(true);
    });

    it('rejects missing languages inside translations', async () => {
      const errors = await getErrors({
        translations: { it: 'Senza glutine', en: 'Gluten free' },
      });
      expect(errors.some((e) => e.property === 'translations')).toBe(true);
    });

    it('rejects empty translation strings', async () => {
      const errors = await getErrors({
        translations: { it: '', en: 'Gluten free', fr: 'Sans gluten' },
      });
      expect(errors.some((e) => e.property === 'translations')).toBe(true);
    });

    it('rejects a non-object translations value', async () => {
      const errors = await getErrors({ translations: 'Senza glutine' });
      expect(errors.some((e) => e.property === 'translations')).toBe(true);
    });

    it('rejects translations longer than 100 characters', async () => {
      const errors = await getErrors({
        translations: {
          it: 'a'.repeat(101),
          en: 'Gluten free',
          fr: 'Sans gluten',
        },
      });
      expect(errors.some((e) => e.property === 'translations')).toBe(true);
    });
  });
});