import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchUserQueryDto } from './search-user-query.dto';

describe('SearchUserQueryDto', () => {
  it('accepts non-empty search string', async () => {
    const dto = plainToInstance(SearchUserQueryDto, { search: 'mario' });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.search).toBe('mario');
  });

  it('rejects missing or empty search string with validation error', async () => {
    const dtoEmpty = plainToInstance(SearchUserQueryDto, { search: '' });
    const errorsEmpty = await validate(dtoEmpty);
    expect(errorsEmpty.length).toBeGreaterThan(0);
    expect(errorsEmpty[0].property).toBe('search');

    const dtoMissing = plainToInstance(SearchUserQueryDto, {});
    const errorsMissing = await validate(dtoMissing);
    expect(errorsMissing.length).toBeGreaterThan(0);
    expect(errorsMissing[0].property).toBe('search');
  });
});
