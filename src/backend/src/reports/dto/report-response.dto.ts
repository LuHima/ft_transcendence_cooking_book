import { ApiProperty } from '@nestjs/swagger';
import { ReportReason, ReportStatus, ReportSubject } from '@prisma/client';

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
   * Justification reason.
   * @example 'spam'
   */
  @ApiProperty({
    enum: ReportReason,
    enumName: 'ReportReason',
    description: 'Justification reason',
    example: ReportReason.spam,
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
