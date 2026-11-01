import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FeedQueryDto } from './feed-query.dto';

describe('FeedQueryDto', () => {
  it('assigns default values page=1 and limit=20 when empty object is passed', () => {
    const dto = plainToInstance(FeedQueryDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.lang).toBeUndefined();
  });

  it('validates and accepts valid page, limit, and allowed languages', async () => {
    for (const lang of ['it', 'en', 'fr'] as const) {
      const dto = plainToInstance(FeedQueryDto, {
        page: '2',
        limit: '15',
        lang,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(15);
      expect(dto.lang).toBe(lang);
    }
  });

  it('rejects invalid language value with validation error', async () => {
    const dto = plainToInstance(FeedQueryDto, {
      lang: 'de',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lang');
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it('rejects page < 1 and limit > 100', async () => {
    const dto = plainToInstance(FeedQueryDto, {
      page: '0',
      limit: '150',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(2);
    const properties = errors.map((e) => e.property);
    expect(properties).toContain('page');
    expect(properties).toContain('limit');
  });
});
