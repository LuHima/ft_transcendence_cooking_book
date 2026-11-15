import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PaginationQueryDto,
  buildPaginatedResponse,
} from './pagination-query.dto';

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

  describe('buildPaginatedResponse', () => {
    it('returns has_prev_page=false when total is 0 even if page > 1', () => {
      expect(buildPaginatedResponse([], 0, 2, 20)).toEqual({
        items: [],
        total: 0,
        page: 2,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      });
    });

    it('computes total_pages, has_next_page, and has_prev_page accurately when total > 0', () => {
      expect(buildPaginatedResponse(['a', 'b'], 25, 2, 10)).toEqual({
        items: ['a', 'b'],
        total: 25,
        page: 2,
        limit: 10,
        total_pages: 3,
        has_next_page: true,
        has_prev_page: true,
      });
    });
  });
});
