import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminCommentQueryDto,
  AdminCommentSortBy,
  AdminCommentFormat,
  AdminCommentStatus,
} from './admin-comment-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

describe('AdminCommentQueryDto', () => {
  it('accepts empty object and provides correct defaults', async () => {
    const dto = plainToInstance(AdminCommentQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.status).toBe(AdminCommentStatus.all);
    expect(dto.sort_by).toBe(AdminCommentSortBy.created_at);
    expect(dto.sort_order).toBeUndefined();
    expect(dto.format).toBe(AdminCommentFormat.flat);
    expect(dto.replies_limit).toBe(5);
  });

  it.each([
    AdminCommentSortBy.created_at,
    AdminCommentSortBy.recipe,
    AdminCommentSortBy.reports_count,
  ])('accepts valid sort_by value %s', async (sortBy) => {
    const dto = plainToInstance(AdminCommentQueryDto, { sort_by: sortBy });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.sort_by).toBe(sortBy);
  });

  it.each([SortOrder.asc, SortOrder.desc])(
    'accepts valid sort_order value %s',
    async (sortOrder) => {
      const dto = plainToInstance(AdminCommentQueryDto, {
        sort_order: sortOrder,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.sort_order).toBe(sortOrder);
    },
  );

  it('rejects invalid sort_by value', async () => {
    const dto = plainToInstance(AdminCommentQueryDto, {
      sort_by: 'invalid_sort_by',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort_by');
  });

  it('rejects invalid sort_order value', async () => {
    const dto = plainToInstance(AdminCommentQueryDto, {
      sort_order: 'invalid_sort_order',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort_order');
  });

  it('rejects limit greater than 100', async () => {
    const dto = plainToInstance(AdminCommentQueryDto, { limit: 101 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('limit');
  });

  it('rejects replies_limit greater than 20', async () => {
    const dto = plainToInstance(AdminCommentQueryDto, { replies_limit: 21 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('replies_limit');
  });
});
