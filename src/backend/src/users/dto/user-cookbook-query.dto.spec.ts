import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserCookbookQueryDto } from './user-cookbook-query.dto';

describe('UserCookbookQueryDto', () => {
  it('applies defaults page=1 and limit=20 and allows lang to be omitted', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.lang).toBeUndefined();
  });

  it('validates and accepts custom page, limit, and supported lang', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {
      page: '3',
      limit: '50',
      lang: 'fr',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
    expect(dto.lang).toBe('fr');
  });

  it('rejects unsupported lang with validation error', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {
      lang: 'es',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('lang');
  });

  it('rejects limit > 100 with validation error', async () => {
    const dto = plainToInstance(UserCookbookQueryDto, {
      limit: '150',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });
});
