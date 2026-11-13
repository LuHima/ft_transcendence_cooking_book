import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportAction, ReportReason } from '@prisma/client';

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
