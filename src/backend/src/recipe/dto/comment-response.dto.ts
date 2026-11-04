import { ApiProperty } from '@nestjs/swagger';
import { RecipeAuthorSummaryDto } from './localized-recipe.response';

/**
 * Public response representation of a recipe comment.
 */
export class RecipeCommentResponseDto {
  @ApiProperty({ description: 'Unique comment ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Recipe ID', example: 42 })
  recipe_id: number;

  @ApiProperty({
    type: Number,
    description: 'Author user ID',
    example: 10,
    nullable: true,
  })
  user_id: number | null;

  @ApiProperty({
    type: Number,
    description:
      'Parent root comment ID if reply, or null for top-level comment',
    example: null,
    nullable: true,
  })
  parent_id: number | null;

  @ApiProperty({
    type: String,
    description:
      'Comment content text, or null if deleted/deactivated with active replies',
    example: 'Ottima ricetta!',
    nullable: true,
  })
  content: string | null;

  @ApiProperty({
    description: 'Whether the comment is active or deactivated',
    example: true,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Whether the comment was edited after posting',
    example: false,
  })
  is_edited: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Creation timestamp',
    example: '2026-10-13T10:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Last update timestamp, or null if never edited',
    example: '2026-10-15T11:00:00.000Z',
    nullable: true,
  })
  updated_at: Date | null;

  @ApiProperty({
    type: RecipeAuthorSummaryDto,
    description: 'Author profile summary, or null if deactivated',
    nullable: true,
  })
  user: RecipeAuthorSummaryDto | null;
}

/**
 * Public response representation of a top-level recipe comment with nested replies.
 */
export class ThreadedRecipeCommentResponseDto extends RecipeCommentResponseDto {
  @ApiProperty({
    type: [RecipeCommentResponseDto],
    description: 'Chronological list of replies to this top-level comment',
  })
  replies: RecipeCommentResponseDto[];
}

/**
 * Paginated collection envelope for dedicated comment replies endpoint.
 */
export class PaginatedRecipeCommentRepliesResponseDto {
  @ApiProperty({
    type: [RecipeCommentResponseDto],
    description: 'Paginated list of replies to the specified comment',
  })
  items: RecipeCommentResponseDto[];

  @ApiProperty({
    description: 'Total number of replies matching query',
    example: 42,
  })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total available pages', example: 3 })
  total_pages: number;

  @ApiProperty({
    description: 'Indicates whether a next page exists',
    example: true,
  })
  has_next_page: boolean;

  @ApiProperty({
    description: 'Indicates whether a previous page exists',
    example: false,
  })
  has_prev_page: boolean;
}
