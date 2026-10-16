import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LocaleQueryDto } from './locale-query.dto';

describe('LocaleQueryDto', () => {
  it('allows optional lang to be omitted or undefined', async () => {
    const dto = plainToInstance(LocaleQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.lang).toBeUndefined();
  });

  it('accepts valid supported languages: it, en, fr', async () => {
    for (const lang of ['it', 'en', 'fr']) {
      const dto = plainToInstance(LocaleQueryDto, { lang });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.lang).toBe(lang);
    }
  });

  it('rejects unsupported language with validation error', async () => {
    const dto = plainToInstance(LocaleQueryDto, { lang: 'es' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lang');
    expect(errors[0].constraints?.isIn).toContain(
      'lang must be one of the following values: it, en, fr',
    );
  });

  it('rejects invalid non-enum values like numbers or arbitrary strings', async () => {
    const dto = plainToInstance(LocaleQueryDto, { lang: '123' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lang');
  });
});
