import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportAction, ReportReason } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

export class BanHistoryItemDto {
  @ApiProperty({
    description: 'Unique ban event identifier (UUID)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({ description: 'Target sanctioned user ID', example: 42 })
  user_id: number;

  @ApiProperty({
    description: 'Staff user ID who issued the ban',
    example: 1,
  })
  banned_by_id: number;

  @ApiPropertyOptional({
    description:
      'Originating report ID if ban was issued via report resolution',
    example: 10,
    nullable: true,
  })
  report_id: number | null;

  @ApiProperty({
    enum: ReportAction,
    enumName: 'ReportAction',
    description: 'Sanction type (ban or warn)',
    example: ReportAction.ban,
    default: ReportAction.ban,
  })
  action: ReportAction;

  @ApiProperty({
    enum: ReportReason,
    enumName: 'ReportReason',
    description: 'Policy violation reason',
    example: ReportReason.harassment_bullying,
  })
  reason: ReportReason;

  @ApiPropertyOptional({
    description: 'User-facing explanation of the sanction',
    example: 'Harassment in recipe comments',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Ban duration in days (null if permanent)',
    example: 30,
    nullable: true,
  })
  duration_days: number | null;

  @ApiProperty({
    description: 'Whether the ban is permanent',
    example: false,
  })
  is_permanent: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Timestamp when the ban was enacted',
    example: '2026-11-04T12:00:00.000Z',
  })
  banned_at: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Scheduled ban expiration timestamp (null if permanent)',
    example: '2026-12-04T12:00:00.000Z',
    nullable: true,
  })
  expires_at: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Timestamp when the ban was lifted',
    example: null,
    nullable: true,
  })
  unbanned_at: Date | null;

  @ApiPropertyOptional({
    description: 'Staff user ID who lifted the ban',
    example: null,
    nullable: true,
  })
  unbanned_by_id: number | null;

  @ApiPropertyOptional({
    description: 'Reason for unbanning',
    example: null,
    nullable: true,
  })
  unban_reason: string | null;
}

/**
 * Query parameters for paginated user ban history retrieval.
 */
export class BanHistoryQueryDto extends PaginationQueryDto {
  /**
   * Sort direction on banned_at timestamp (asc or desc).
   * @example SortOrder.desc
   */
  @ApiPropertyOptional({
    description: 'Sort direction on banned_at timestamp',
    enum: SortOrder,
    default: SortOrder.desc,
    example: SortOrder.desc,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.desc;
}

/**
 * Paginated collection envelope for user sanction history records.
 */
export class PaginatedBanHistoryResponseDto {
  @ApiProperty({
    type: [BanHistoryItemDto],
    description: 'Chronological sanction audit records for the target user',
  })
  items: BanHistoryItemDto[];

  @ApiProperty({
    description: 'Total number of sanction records for the user',
    example: 3,
  })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total available pages', example: 1 })
  total_pages: number;

  @ApiProperty({
    description: 'Indicates whether a next page exists',
    example: false,
  })
  has_next_page: boolean;

  @ApiProperty({
    description: 'Indicates whether a previous page exists',
    example: false,
  })
  has_prev_page: boolean;
}
