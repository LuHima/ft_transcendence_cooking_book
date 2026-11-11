import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SortOrder } from '../../common/dto/sort-order.enum';

export enum AdminCommentSortBy {
  created_at = 'created_at',
  recipe = 'recipe',
  reports_count = 'reports_count',
}

export enum AdminCommentFormat {
  flat = 'flat',
  threaded = 'threaded',
}

export enum AdminCommentStatus {
  active = 'active',
  inactive = 'inactive',
  all = 'all',
}

/**
 * Query parameters for administrative comment audit stream.
 */
export class AdminCommentQueryDto {
  /**
   * 1-based page window index.
   * @example 1
   */
  @ApiPropertyOptional({
    description: '1-based page window index',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Number of items per page window (1 to 100).
   * @example 20
   */
  @ApiPropertyOptional({
    description: 'Number of items per page window (1 to 100)',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /**
   * Case-insensitive substring search in comment content.
   * @example 'spaghetti'
   */
  @ApiPropertyOptional({
    description: 'Case-insensitive substring search in comment content',
    example: 'recipe',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Filter comments by lifecycle status (active, inactive, all).
   * @example 'all'
   */
  @ApiPropertyOptional({
    enum: AdminCommentStatus,
    description: 'Filter comments by lifecycle status (active, inactive, all)',
    default: AdminCommentStatus.all,
  })
  @IsOptional()
  @IsEnum(AdminCommentStatus)
  status?: AdminCommentStatus = AdminCommentStatus.all;

  /**
   * Filter comments targeting a specific recipe.
   * @example 42
   */
  @ApiPropertyOptional({
    description: 'Filter comments targeting a specific recipe ID',
    example: 42,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  recipe_id?: number;

  /**
   * Filter comments authored by a specific user.
   * @example 10
   */
  @ApiPropertyOptional({
    description: 'Filter comments authored by a specific user ID',
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_id?: number;

  /**
   * Filter comments by modification state (is_edited).
   * @example true
   */
  @ApiPropertyOptional({
    description: 'Filter comments modified after initial publication',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  is_edited?: boolean;

  /**
   * Filter comments with active pending reports only.
   * @example true
   */
  @ApiPropertyOptional({
    description: 'Filter comments having at least one report in pending status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  reported_only?: boolean;

  private _sort_by?: AdminCommentSortBy;

  /**
   * Field to sort comments by.
   * @example AdminCommentSortBy.created_at
   */
  @ApiPropertyOptional({
    enum: AdminCommentSortBy,
    description:
      'Field to sort comments by: created_at (default), recipe, reports_count (default when reported_only=true)',
    default: AdminCommentSortBy.created_at,
    example: AdminCommentSortBy.created_at,
  })
  @IsOptional()
  @IsEnum(AdminCommentSortBy)
  get sort_by(): AdminCommentSortBy {
    if (this._sort_by !== undefined) {
      return this._sort_by;
    }
    if (this.reported_only) {
      return AdminCommentSortBy.reports_count;
    }
    return AdminCommentSortBy.created_at;
  }

  set sort_by(value: AdminCommentSortBy | undefined) {
    this._sort_by = value;
  }

  /**
   * Sort direction. Defaults contextually to desc for created_at and reports_count, asc for recipe.
   * @example SortOrder.desc
   */
  @ApiPropertyOptional({
    enum: SortOrder,
    description:
      'Sort direction. Defaults to desc for created_at and reports_count, asc for recipe.',
    example: SortOrder.desc,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder;

  /**
   * Presentation structural format.
   * flat: atomic comment feed.
   * threaded: root comments with windowed reply previews.
   * @example 'flat'
   */
  @ApiPropertyOptional({
    enum: AdminCommentFormat,
    description:
      'Structural presentation format: flat (default atomic stream) or threaded (paginated root comments with windowed reply previews)',
    default: AdminCommentFormat.flat,
  })
  @IsOptional()
  @IsEnum(AdminCommentFormat)
  format?: AdminCommentFormat = AdminCommentFormat.flat;

  /**
   * Maximum child replies embedded per root comment when format=threaded (1 to 20).
   * @example 5
   */
  @ApiPropertyOptional({
    description:
      'Max number of nested child replies to embed per root comment when format=threaded (1 to 20)',
    default: 5,
    minimum: 1,
    maximum: 20,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  replies_limit?: number = 5;

  /**
   * Preferred language locale for recipe title hydration.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description: 'Preferred language locale for recipe title hydration',
    example: 'it',
  })
  @IsOptional()
  @IsString()
  lang?: string;
}
