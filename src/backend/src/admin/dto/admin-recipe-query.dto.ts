import { ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import {
  FilterRecipeDto,
  RecipeSortOrder,
} from '../../recipe/dto/filter-recipe.dto';
import {
  createContextualSortByAccessor,
  transformOptionalBoolean,
} from '../../common/dto/query-transforms';

export enum AdminRecipeStatus {
  active = 'active',
  inactive = 'inactive',
  all = 'all',
}

export enum AdminRecipeSortBy {
  created_at = 'created_at',
  total_time = 'total_time',
  difficulty = 'difficulty',
  likes_count = 'likes_count',
  title = 'title',
  pending_reports_count = 'pending_reports_count',
  reports_count = 'reports_count',
}

const sortByAccessor = createContextualSortByAccessor<
  AdminRecipeQueryDto,
  AdminRecipeSortBy
>(AdminRecipeSortBy.created_at, AdminRecipeSortBy.pending_reports_count);

/**
 * Query parameters for administrative and staff recipe search stream.
 */
export class AdminRecipeQueryDto extends OmitType(FilterRecipeDto, [
  'sort_by',
] as const) {
  /**
   * Filter recipes by lifecycle status (active, inactive, all).
   * @example 'all'
   */
  @ApiPropertyOptional({
    enum: AdminRecipeStatus,
    description: 'Filter recipes by lifecycle status (active, inactive, all)',
    default: AdminRecipeStatus.all,
    example: AdminRecipeStatus.all,
  })
  @IsOptional()
  @IsEnum(AdminRecipeStatus)
  status?: AdminRecipeStatus = AdminRecipeStatus.all;

  /**
   * Filter recipes having at least one active pending recipe report (subject = recipe).
   * @example true
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes having at least one active pending report (subject = recipe)',
    example: true,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  reported_only?: boolean;

  /**
   * Field to sort recipes by. Defaults to pending_reports_count when reported_only=true, otherwise created_at.
   * @example AdminRecipeSortBy.created_at
   */
  @ApiPropertyOptional({
    description:
      'Field to sort recipes by: created_at (default), total_time, difficulty, likes_count, title, pending_reports_count (default when reported_only=true), or reports_count',
    enum: AdminRecipeSortBy,
    default: AdminRecipeSortBy.created_at,
    example: AdminRecipeSortBy.created_at,
  })
  @IsOptional()
  @IsEnum(AdminRecipeSortBy)
  get sort_by(): AdminRecipeSortBy {
    return sortByAccessor.get(this);
  }

  set sort_by(value: AdminRecipeSortBy | undefined) {
    sortByAccessor.set(this, value);
  }

  /**
   * Sort direction. Defaults contextually to desc for created_at, likes_count, pending_reports_count, and reports_count; asc for total_time, difficulty, and title.
   * @example RecipeSortOrder.desc
   */
  @ApiPropertyOptional({
    description:
      'Sort direction. Defaults to "desc" for created_at, likes_count, pending_reports_count, and reports_count; "asc" for total_time, difficulty, and title',
    enum: RecipeSortOrder,
    example: RecipeSortOrder.desc,
  })
  @IsOptional()
  @IsEnum(RecipeSortOrder)
  override sort_order?: RecipeSortOrder;
}
