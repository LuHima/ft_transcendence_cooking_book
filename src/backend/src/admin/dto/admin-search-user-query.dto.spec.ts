import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminSearchUserQueryDto } from './admin-search-user-query.dto';

describe('AdminSearchUserQueryDto', () => {
  it('rejects non-string search values instead of turning them into undefined', async () => {
    const dto = plainToInstance(AdminSearchUserQueryDto, {
      search: ['mario', 'luigi'],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });

  it('rejects search exceeding 100 characters', async () => {
    const dto = plainToInstance(AdminSearchUserQueryDto, {
      search: 'a'.repeat(101),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'search')).toBe(true);
  });
});
