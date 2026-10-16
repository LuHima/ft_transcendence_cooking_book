import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  it('assigns default values page=1 and limit=20 when empty object is passed', () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('validates and accepts valid page and limit within bounds', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      page: '3',
      limit: '50',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
  });

  it('rejects page < 1 with validation error', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      page: '0',
      limit: '20',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('page');
  });

  it('rejects limit < 1 with validation error', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      page: '1',
      limit: '0',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('rejects limit > 100 with validation error', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      page: '1',
      limit: '101',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
    expect(errors[0].constraints).toHaveProperty('max');
  });
});
