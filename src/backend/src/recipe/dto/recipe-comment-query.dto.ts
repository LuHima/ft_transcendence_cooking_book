import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

/**
 * Supported sort fields for public recipe comments.
 */
export enum RecipeCommentSortBy {
  latest_activity = 'latest_activity',
  created_at = 'created_at',
}

/**
 * Query parameters for retrieving paginated and threaded recipe comments.
 */
export class RecipeCommentQueryDto extends PaginationQueryDto {
  /**
   * Maximum child replies embedded per root comment (1 to 20).
   * @example 5
   */
  @ApiPropertyOptional({
    description:
      'Max number of nested child replies to embed per root comment (1 to 20)',
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
   * Field to sort root comments by.
   * @example RecipeCommentSortBy.latest_activity
   */
  @ApiPropertyOptional({
    enum: RecipeCommentSortBy,
    description:
      'Field to sort root comments by: latest_activity (default) or created_at',
    default: RecipeCommentSortBy.latest_activity,
    example: RecipeCommentSortBy.latest_activity,
  })
  @IsOptional()
  @IsEnum(RecipeCommentSortBy)
  sort_by?: RecipeCommentSortBy = RecipeCommentSortBy.latest_activity;

  /**
   * Sort direction. Defaults to desc.
   * @example SortOrder.desc
   */
  @ApiPropertyOptional({
    enum: SortOrder,
    description: 'Sort direction. Defaults to desc.',
    default: SortOrder.desc,
    example: SortOrder.desc,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.desc;
}
