import { ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { RecipeAuthorSummaryDto } from '../../recipe/dto/localized-recipe.response';

/**
 * Hydrated summary of a recipe referenced by a comment.
 */
export class AdminCommentRecipeSummaryDto {
  @ApiProperty({ description: 'Recipe ID', example: 42 })
  id: number;

  @ApiProperty({
    description: 'Localized or source recipe title',
    example: 'Spaghetti alla Carbonara',
  })
  title: string;
}

/**
 * Administrative view item representing a comment or child reply.
 */
export class AdminCommentItemDto {
  @ApiProperty({ description: 'Unique comment ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Recipe ID', example: 42 })
  recipe_id: number;

  @ApiProperty({
    type: Number,
    description: 'Author user ID, or null if deleted/deactivated',
    example: 10,
    nullable: true,
  })
  user_id: number | null;

  @ApiProperty({
    type: Number,
    description:
      'Parent root comment ID if reply, or null for top-level root comment',
    example: null,
    nullable: true,
  })
  parent_id: number | null;

  @ApiProperty({
    description: 'Comment content text in authentic author-composed language',
    example: 'Ottima ricetta!',
  })
  content: string;

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
    description:
      'Number of active pending moderation reports filed against this comment',
    example: 3,
  })
  reports_count: number;

  @ApiProperty({
    description:
      'Number of active pending moderation reports filed against this comment',
    example: 1,
  })
  pending_reports_count: number;

  @ApiProperty({
    description:
      'Whether this comment currently has at least one active pending moderation report',
    example: true,
  })
  has_pending_reports: boolean;

  @ApiProperty({
    type: RecipeAuthorSummaryDto,
    description: 'Author profile summary',
    nullable: true,
  })
  user: RecipeAuthorSummaryDto | null;

  @ApiProperty({
    type: AdminCommentRecipeSummaryDto,
    description: 'Recipe summary metadata',
    nullable: true,
  })
  recipe: AdminCommentRecipeSummaryDto | null;
}

/**
 * Threaded root comment audit item embedding windowed reply previews.
 */
export class ThreadedAdminCommentItemDto extends AdminCommentItemDto {
  @ApiProperty({
    description: 'Total number of child replies belonging to this root thread',
    example: 12,
  })
  replies_count: number;

  @ApiProperty({
    description:
      'Total number of child replies in this thread that have active pending reports',
    example: 2,
  })
  reported_replies_count: number;

  @ApiProperty({
    description:
      'Cumulative pending report count across the root comment and all child replies',
    example: 3,
  })
  thread_pending_reports_count: number;

  @ApiProperty({
    description:
      'Indicates whether more replies exist beyond the embedded preview window',
    example: true,
  })
  has_more_replies: boolean;

  @ApiProperty({
    type: [AdminCommentItemDto],
    description:
      'Windowed preview of recent child replies (up to replies_limit)',
  })
  replies: AdminCommentItemDto[];
}

/**
 * Paginated collection envelope for administrative comment audit stream.
 */
export class PaginatedAdminCommentsResponseDto {
  @ApiProperty({
    description:
      'Comment items (flat comment records or threaded root comments with windowed replies)',
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(AdminCommentItemDto) },
        { $ref: getSchemaPath(ThreadedAdminCommentItemDto) },
      ],
    },
  })
  items: (AdminCommentItemDto | ThreadedAdminCommentItemDto)[];

  @ApiProperty({
    description: 'Total number of matching comments (or root threads)',
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
