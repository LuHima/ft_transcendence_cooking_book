import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  RecipeCommentQueryDto,
  RecipeCommentSortBy,
} from './recipe-comment-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

describe('RecipeCommentQueryDto', () => {
  it('accepts empty object and provides correct defaults', async () => {
    const dto = plainToInstance(RecipeCommentQueryDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.replies_limit).toBe(5);
    expect(dto.sort_by).toBe(RecipeCommentSortBy.latest_activity);
    expect(dto.sort_order).toBe(SortOrder.desc);
  });

  it.each([
    RecipeCommentSortBy.latest_activity,
    RecipeCommentSortBy.created_at,
  ])('accepts valid sort_by value %s', async (sortBy) => {
    const dto = plainToInstance(RecipeCommentQueryDto, { sort_by: sortBy });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.sort_by).toBe(sortBy);
  });

  it.each([SortOrder.asc, SortOrder.desc])(
    'accepts valid sort_order value %s',
    async (sortOrder) => {
      const dto = plainToInstance(RecipeCommentQueryDto, {
        sort_order: sortOrder,
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.sort_order).toBe(sortOrder);
    },
  );

  it('rejects invalid sort_by value', async () => {
    const dto = plainToInstance(RecipeCommentQueryDto, {
      sort_by: 'invalid_sort_by',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort_by');
  });

  it('rejects invalid sort_order value', async () => {
    const dto = plainToInstance(RecipeCommentQueryDto, {
      sort_order: 'invalid_order',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('sort_order');
  });

  it('transforms string integers for page, limit, and replies_limit', async () => {
    const dto = plainToInstance(RecipeCommentQueryDto, {
      page: '3',
      limit: '50',
      replies_limit: '15',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.page).toBe(3);
    expect(dto.limit).toBe(50);
    expect(dto.replies_limit).toBe(15);
  });

  it('rejects negative or out-of-range replies_limit', async () => {
    const dtoBelow = plainToInstance(RecipeCommentQueryDto, {
      replies_limit: 0,
    });
    const errorsBelow = await validate(dtoBelow);
    expect(errorsBelow.length).toBeGreaterThan(0);
    expect(errorsBelow[0].property).toBe('replies_limit');

    const dtoAbove = plainToInstance(RecipeCommentQueryDto, {
      replies_limit: 25,
    });
    const errorsAbove = await validate(dtoAbove);
    expect(errorsAbove.length).toBeGreaterThan(0);
    expect(errorsAbove[0].property).toBe('replies_limit');
  });
});
