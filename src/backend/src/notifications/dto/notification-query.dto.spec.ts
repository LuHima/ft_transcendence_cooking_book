import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotificationQueryDto } from './notification-query.dto';

describe('NotificationQueryDto', () => {
  it('assigns default values page=1 and limit=20 when empty object is passed', () => {
    const dto = plainToInstance(NotificationQueryDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.unread_only).toBeUndefined();
    expect(dto.lang).toBeUndefined();
  });

  it('validates and accepts valid page, limit, unread_only, and allowed languages', async () => {
    for (const lang of ['it', 'en', 'fr'] as const) {
      const dto = plainToInstance(NotificationQueryDto, {
        page: '2',
        limit: '15',
        unread_only: 'true',
        lang,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.page).toBe(2);
      expect(dto.limit).toBe(15);
      expect(dto.unread_only).toBe(true);
      expect(dto.lang).toBe(lang);
    }
  });

  it('correctly transforms string and boolean representations of unread_only', () => {
    const dtoTrueString = plainToInstance(NotificationQueryDto, {
      unread_only: 'true',
    });
    expect(dtoTrueString.unread_only).toBe(true);

    const dtoFalseString = plainToInstance(NotificationQueryDto, {
      unread_only: 'false',
    });
    expect(dtoFalseString.unread_only).toBe(false);

    const dtoTrueBool = plainToInstance(NotificationQueryDto, {
      unread_only: true,
    });
    expect(dtoTrueBool.unread_only).toBe(true);

    const dtoFalseBool = plainToInstance(NotificationQueryDto, {
      unread_only: false,
    });
    expect(dtoFalseBool.unread_only).toBe(false);
  });

  it('rejects invalid language value with validation error', async () => {
    const dto = plainToInstance(NotificationQueryDto, {
      lang: 'de',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lang');
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it('rejects page < 1 and limit > 100', async () => {
    const dto = plainToInstance(NotificationQueryDto, {
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
