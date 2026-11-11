import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason, ReportStatus, ReportSubject } from '@prisma/client';

/**
 * Hydrated profile information for the reporter who submitted a report.
 */
export class ReportReporterDto {
  @ApiProperty({ description: 'Numeric user ID of the reporter', example: 5 })
  id: number;

  @ApiProperty({ description: 'Username of the reporter', example: 'mario_rossi' })
  username: string;

  @ApiProperty({
    description: 'Avatar image URL of the reporter',
    example: '/uploads/avatars/avatar_5.webp',
    nullable: true,
    type: String,
  })
  avatar_url: string | null;
}

/**
 * Author or owner profile card for reported target content.
 */
export class ReportTargetOwnerDto {
  @ApiProperty({ description: 'Numeric user ID of the content owner', example: 10 })
  id: number;

  @ApiProperty({ description: 'Username of the content owner', example: 'chef_luigi' })
  username: string;

  @ApiPropertyOptional({
    description: 'Avatar image URL of the content owner',
    example: '/uploads/avatars/avatar_10.webp',
    nullable: true,
    type: String,
  })
  avatar_url: string | null;
}

/**
 * Polymorphic target context providing localized recipe title, comment snippet, user handle, and parent recipe associations.
 */
export class ReportTargetSummaryDto {
  @ApiProperty({
    description:
      'Localized title for recipe, content snippet for comment, or username for user',
    example: 'Spaghetti alla Carbonara',
  })
  label: string;

  @ApiPropertyOptional({
    description: 'Parent recipe ID for comment reports, or recipe ID for recipe reports',
    example: 42,
    type: Number,
  })
  recipe_id?: number;

  @ApiPropertyOptional({
    description: 'Author or owner of the reported entity',
    type: ReportTargetOwnerDto,
    nullable: true,
  })
  owner?: ReportTargetOwnerDto | null;
}

/**
 * Moderation report item representation.
 */
export class ReportItemDto {
  /**
   * Unique report identifier.
   * @example 1
   */
  @ApiProperty({ description: 'Unique report identifier', example: 1 })
  id: number;

  /**
   * User identifier of the reporter.
   * @example 5
   */
  @ApiProperty({
    description: 'User ID of the member who submitted the report',
    example: 5,
  })
  reporter_id: number;

  /**
   * Hydrated profile details of the reporter.
   */
  @ApiPropertyOptional({
    description: 'Hydrated profile details of the reporter',
    type: ReportReporterDto,
    nullable: true,
  })
  reporter?: ReportReporterDto | null;

  /**
   * Target subject entity type.
   * @example 'recipe'
   */
  @ApiProperty({
    enum: ReportSubject,
    enumName: 'ReportSubject',
    description: 'Target subject entity type',
    example: ReportSubject.recipe,
  })
  subject: ReportSubject;

  /**
   * Target entity ID.
   * @example 42
   */
  @ApiProperty({ description: 'Target entity ID', example: 42 })
  target_id: number;

  /**
   * Polymorphic target summary context.
   */
  @ApiPropertyOptional({
    description: 'Polymorphic target summary context',
    type: ReportTargetSummaryDto,
    nullable: true,
  })
  target?: ReportTargetSummaryDto | null;

  /**
   * Justification reason.
   * @example 'spam'
   */
  @ApiProperty({
    enum: ReportReason,
    enumName: 'ReportReason',
    description: 'Justification reason',
    example: ReportReason.spam_scam,
  })
  reason: ReportReason;

  /**
   * Description provided by the reporter.
   * @example 'Repeated advertising links'
   */
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Description provided by reporter',
    example: 'Repeated advertising links',
  })
  description: string | null;

  /**
   * Current moderation status.
   * @example 'pending'
   */
  @ApiProperty({
    enum: ReportStatus,
    enumName: 'ReportStatus',
    description: 'Current moderation triage status',
    example: ReportStatus.pending,
  })
  status: ReportStatus;

  /**
   * Internal resolution notes.
   * @example null
   */
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Resolution notes recorded by moderator or admin',
    example: null,
  })
  resolution_notes: string | null;

  /**
   * Formal violation reason applied when resolving the report.
   * @example ReportReason.harassment_bullying
   */
  @ApiProperty({
    enum: ReportReason,
    enumName: 'ReportReason',
    nullable: true,
    description: 'Formal policy violation category resolved',
    example: null,
  })
  resolution_reason?: ReportReason | null;

  /**
   * User-facing explanation delivered to the penalized member.
   * @example null
   */
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'User-facing explanation of the disciplinary action',
    example: null,
  })
  resolution_description?: string | null;

  /**
   * Total number of historical bans issued to the reported user or author.
   * @example 0
   */
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Previous sanctions count for recidivism tracking',
    example: 0,
  })
  previous_bans_count?: number | null;

  /**
   * User identifier of staff member who resolved the report.
   * @example 2
   */
  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Staff member who resolved the report',
    example: null,
  })
  resolved_by_id?: number | null;

  /**
   * Timestamp when report was resolved.
   * @example '2026-11-04T12:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Timestamp when report was resolved',
    example: null,
  })
  resolved_at?: Date | null;

  /**
   * Creation timestamp.
   * @example '2026-11-02T12:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Timestamp when report was submitted',
    example: '2026-11-02T12:00:00.000Z',
  })
  created_at: Date;

  /**
   * Last updated timestamp.
   * @example '2026-11-02T12:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Timestamp when report was last modified',
    example: '2026-11-02T12:00:00.000Z',
  })
  updated_at: Date;
}

/**
 * Paginated collection of moderation reports.
 */
export class PaginatedReportsResponseDto {
  @ApiProperty({
    type: [ReportItemDto],
    description: 'List of reports',
  })
  items: ReportItemDto[];

  @ApiProperty({ description: 'Total number of reports', example: 1 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of available pages', example: 1 })
  total_pages: number;

  @ApiProperty({
    description: 'Flag indicating if next page exists',
    example: false,
  })
  has_next_page: boolean;

  @ApiProperty({
    description: 'Flag indicating if previous page exists',
    example: false,
  })
  has_prev_page: boolean;
}
