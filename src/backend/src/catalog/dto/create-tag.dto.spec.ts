import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTagDto } from './create-tag.dto';

describe('CreateTagDto', () => {
  const validPayload = {
    slug: 'gluten_free',
    translations: {
      it: 'Senza glutine',
      en: 'Gluten free',
      fr: 'Sans gluten',
    },
  };

  const getErrors = async (payload: unknown) => {
    const dto = plainToInstance(CreateTagDto, payload);
    return validate(dto);
  };

  describe('valid payloads', () => {
    it('accepts a fully valid payload', async () => {
      const errors = await getErrors(validPayload);
      expect(errors).toHaveLength(0);
    });

    it('accepts slugs with digits and single underscores', async () => {
      const errors = await getErrors({
        ...validPayload,
        slug: 'omega_3',
      });
      expect(errors).toHaveLength(0);
    });

    it('accepts a slug at the maximum length (50)', async () => {
      const errors = await getErrors({
        ...validPayload,
        slug: 'a'.repeat(50),
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid slug', () => {
    it('rejects slugs with uppercase letters', async () => {
      const errors = await getErrors({ ...validPayload, slug: 'Gluten_Free' });
      expect(errors.some((e) => e.property === 'slug')).toBe(true);
    });

    it('rejects slugs with hyphens', async () => {
      const errors = await getErrors({ ...validPayload, slug: 'gluten-free' });
      expect(errors.some((e) => e.property === 'slug')).toBe(true);
    });

    it('rejects slugs with consecutive underscores', async () => {
      const errors = await getErrors({ ...validPayload, slug: 'gluten__free' });
      expect(errors.some((e) => e.property === 'slug')).toBe(true);
    });

    it('rejects slugs with a trailing underscore', async () => {
      const errors = await getErrors({ ...validPayload, slug: 'gluten_' });
      expect(errors.some((e) => e.property === 'slug')).toBe(true);
    });

    it('rejects an empty slug', async () => {
      const errors = await getErrors({ ...validPayload, slug: '' });
      expect(errors.some((e) => e.property === 'slug')).toBe(true);
    });

    it('rejects a slug longer than 50 characters', async () => {
      const errors = await getErrors({
        ...validPayload,
        slug: 'a'.repeat(51),
      });
      expect(errors.some((e) => e.property === 'slug')).toBe(true);
    });
  });

  describe('invalid translations', () => {
    it('rejects a missing translations object', async () => {
      const errors = await getErrors({ slug: 'gluten_free' });
      expect(errors.some((e) => e.property === 'translations')).toBe(true);
    });

    it('rejects missing languages inside translations', async () => {
      const errors = await getErrors({
        slug: 'gluten_free',
        translations: { it: 'Senza glutine', en: 'Gluten free' },
      });
      expect(errors.some((e) => e.property === 'translations')).toBe(true);
    });

    it('rejects empty translation strings', async () => {
      const errors = await getErrors({
        slug: 'gluten_free',
        translations: { it: '', en: 'Gluten free', fr: 'Sans gluten' },
      });
      expect(errors.some((e) => e.property === 'translations')).toBe(true);
    });

    it('rejects translations longer than 100 characters', async () => {
      const errors = await getErrors({
        slug: 'gluten_free',
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