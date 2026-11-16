import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';
import {
  createContextualSortByAccessor,
  transformOptionalBoolean,
} from '../../common/dto/query-transforms';
import { trimToUndefined } from '../../common/dto/string-transforms';
import {
  INT32_MAX,
  MAX_SEARCH_LENGTH,
  SUPPORTED_LOCALES,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

export enum AdminCommentSortBy {
  created_at = 'created_at',
  recipe = 'recipe',
  reports_count = 'reports_count',
  pending_reports_count = 'pending_reports_count',
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

const sortByAccessor = createContextualSortByAccessor<
  AdminCommentQueryDto,
  AdminCommentSortBy
>(AdminCommentSortBy.created_at, AdminCommentSortBy.pending_reports_count);

/**
 * Query parameters for administrative comment audit stream.
 */
export class AdminCommentQueryDto extends PaginationQueryDto {
  /**
   * Case-insensitive substring search in comment content.
   * @example 'spaghetti'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search in comment content (max 100 characters)',
    maxLength: MAX_SEARCH_LENGTH,
    example: 'recipe',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'search query must be a text string' })
  @MaxLength(MAX_SEARCH_LENGTH, {
    message: `search query cannot exceed ${MAX_SEARCH_LENGTH} characters`,
  })
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
  @IsEnum(AdminCommentStatus, {
    message: 'status must be one of: active, inactive, all',
  })
  status?: AdminCommentStatus = AdminCommentStatus.all;

  /**
   * Filter comments targeting a specific recipe.
   * @example 42
   */
  @ApiPropertyOptional({
    description: 'Filter comments targeting a specific recipe ID',
    minimum: 1,
    maximum: INT32_MAX,
    example: 42,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: VALIDATION_MESSAGES.idRange })
  @Min(1, { message: VALIDATION_MESSAGES.idRange })
  @Max(INT32_MAX, { message: VALIDATION_MESSAGES.idRange })
  recipe_id?: number;

  /**
   * Filter comments authored by a specific user.
   * @example 10
   */
  @ApiPropertyOptional({
    description: 'Filter comments authored by a specific user ID',
    minimum: 1,
    maximum: INT32_MAX,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: VALIDATION_MESSAGES.idRange })
  @Min(1, { message: VALIDATION_MESSAGES.idRange })
  @Max(INT32_MAX, { message: VALIDATION_MESSAGES.idRange })
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
  @Transform(transformOptionalBoolean)
  @IsBoolean({ message: 'is_edited must be a boolean (true or false)' })
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
  @Transform(transformOptionalBoolean)
  @IsBoolean({ message: 'reported_only must be a boolean (true or false)' })
  reported_only?: boolean;

  /**
   * Field to sort comments by.
   * @example AdminCommentSortBy.created_at
   */
  @ApiPropertyOptional({
    enum: AdminCommentSortBy,
    description:
      'Field to sort comments by: created_at (default), recipe, reports_count (all-status total), pending_reports_count (default when reported_only=true)',
    default: AdminCommentSortBy.created_at,
    example: AdminCommentSortBy.created_at,
  })
  @IsOptional()
  @IsEnum(AdminCommentSortBy, { message: 'Invalid sort_by value' })
  get sort_by(): AdminCommentSortBy {
    return sortByAccessor.get(this);
  }

  set sort_by(value: AdminCommentSortBy | undefined) {
    sortByAccessor.set(this, value);
  }

  /**
   * Sort direction. Defaults contextually to desc for created_at, reports_count, and pending_reports_count; asc for recipe.
   * @example SortOrder.desc
   */
  @ApiPropertyOptional({
    enum: SortOrder,
    description:
      'Sort direction. Defaults to desc for created_at, reports_count, and pending_reports_count; asc for recipe.',
    example: SortOrder.desc,
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: 'sort_order must be asc or desc' })
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
  @IsEnum(AdminCommentFormat, {
    message: 'format must be either flat or threaded',
  })
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
  @IsInt({ message: 'replies_limit must be a whole number' })
  @Min(1, { message: 'replies_limit must be at least 1' })
  @Max(20, { message: 'replies_limit cannot exceed 20' })
  replies_limit?: number = 5;

  /**
   * Preferred language locale for recipe title hydration.
   * @example 'it'
   */
  @ApiPropertyOptional({
    enum: SUPPORTED_LOCALES,
    description:
      'Preferred language locale for recipe title hydration (it, en, fr)',
    example: 'it',
  })
  @IsOptional()
  @IsString({ message: 'lang must be a text string' })
  @IsIn(SUPPORTED_LOCALES, { message: VALIDATION_MESSAGES.langUnsupported })
  lang?: 'it' | 'en' | 'fr';
}
