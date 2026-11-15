import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminRecipeQueryDto,
  AdminRecipeSortBy,
  AdminRecipeStatus,
} from './admin-recipe-query.dto';
import { RecipeSortOrder } from '../../recipe/dto/filter-recipe.dto';

describe('AdminRecipeQueryDto', () => {
  it('accepts empty object with default status=all and sort_by=created_at', async () => {
    const dto = plainToInstance(AdminRecipeQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.status).toBe(AdminRecipeStatus.all);
    expect(dto.sort_by).toBe(AdminRecipeSortBy.created_at);
    expect(dto.reported_only).toBeUndefined();
  });

  it('defaults sort_by to pending_reports_count when reported_only=true and sort_by is omitted', async () => {
    const dto = plainToInstance(AdminRecipeQueryDto, {
      reported_only: 'true',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.reported_only).toBe(true);
    expect(dto.sort_by).toBe(AdminRecipeSortBy.pending_reports_count);
  });

  it('preserves explicit sort_by when reported_only=true', async () => {
    const dto = plainToInstance(AdminRecipeQueryDto, {
      reported_only: true,
      sort_by: AdminRecipeSortBy.reports_count,
      sort_order: RecipeSortOrder.asc,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.reported_only).toBe(true);
    expect(dto.sort_by).toBe(AdminRecipeSortBy.reports_count);
    expect(dto.sort_order).toBe(RecipeSortOrder.asc);
  });

  it('does not default sort_by to pending_reports_count when reported_only=false', async () => {
    const dto = plainToInstance(AdminRecipeQueryDto, {
      reported_only: 'false',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.reported_only).toBe(false);
    expect(dto.sort_by).toBe(AdminRecipeSortBy.created_at);
  });

  it.each([
    AdminRecipeSortBy.created_at,
    AdminRecipeSortBy.total_time,
    AdminRecipeSortBy.difficulty,
    AdminRecipeSortBy.likes_count,
    AdminRecipeSortBy.title,
    AdminRecipeSortBy.pending_reports_count,
    AdminRecipeSortBy.reports_count,
  ])('accepts valid AdminRecipeSortBy value %s', async (sortBy) => {
    const dto = plainToInstance(AdminRecipeQueryDto, { sort_by: sortBy });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.sort_by).toBe(sortBy);
  });
});
