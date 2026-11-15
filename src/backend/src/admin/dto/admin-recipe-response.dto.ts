import { ApiProperty } from '@nestjs/swagger';
import { LocalizedRecipeSummaryResponse } from '../../recipe/dto/localized-recipe.response';

/**
 * Administrative recipe stream item extending the public localized recipe summary
 * with recipe-level moderation report counters and quick-triage reference.
 */
export class AdminRecipeItemDto extends LocalizedRecipeSummaryResponse {
  @ApiProperty({
    type: [String],
    description: 'List of available locale projections for this recipe',
    example: ['it', 'en', 'fr'],
  })
  declare available_languages: string[];

  @ApiProperty({
    description:
      'Total number of moderation reports filed against this recipe (subject = recipe) across all statuses',
    example: 3,
  })
  reports_count: number;

  @ApiProperty({
    description:
      'Number of active pending moderation reports filed against this recipe (subject = recipe)',
    example: 1,
  })
  pending_reports_count: number;

  @ApiProperty({
    description:
      'Whether this recipe currently has at least one active pending recipe report',
    example: true,
  })
  has_pending_reports: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'ID of the most recent active pending report for this recipe (ordered by created_at DESC, id DESC), or null when none are pending',
    example: 204,
  })
  latest_pending_report_id: number | null;
}

/**
 * Paginated collection envelope for the administrative recipe stream.
 */
export class PaginatedAdminRecipesResponseDto {
  @ApiProperty({
    type: [AdminRecipeItemDto],
    description: 'Administrative recipe summary items with report counters',
  })
  items: AdminRecipeItemDto[];

  @ApiProperty({ description: 'Total number of matching recipes', example: 42 })
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
