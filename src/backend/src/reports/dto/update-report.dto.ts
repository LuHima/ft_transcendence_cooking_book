import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '@prisma/client';

/**
 * Payload for updating moderation report status and recording resolution notes.
 */
export class UpdateReportDto {
  /**
   * New moderation status for the report.
   * @example 'reviewed'
   */
  @ApiProperty({
    enum: ReportStatus,
    enumName: 'ReportStatus',
    description: 'Updated report triage status',
    example: ReportStatus.reviewed,
  })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  /**
   * Internal staff resolution notes documenting findings or action taken.
   * @example 'Content reviewed and removed; user warned.'
   */
  @ApiPropertyOptional({
    description: 'Internal staff notes documenting findings or action taken',
    maxLength: 1000,
    example: 'Content reviewed and removed; user warned.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution_notes?: string;

  /**
   * Specific resolution action applied when resolving report with action_taken.
   * Supports 'delete_content', 'ban', 'warn', 'dismiss'.
   * @example 'delete_content'
   */
  @ApiPropertyOptional({
    description:
      'Specific moderation action executed when resolving the report with action_taken (delete_content, ban, warn, dismiss)',
    enum: ['delete_content', 'ban', 'warn', 'dismiss'],
    example: 'delete_content',
  })
  @IsOptional()
  @IsString()
  resolution?: string;

  /**
   * Alternative alias for resolution action (ADR 0021 compatibility).
   * @example 'delete_content'
   */
  @ApiPropertyOptional({
    description:
      'Alternative alias for resolution action (delete_content, ban, warn, dismiss)',
    enum: ['delete_content', 'ban', 'warn', 'dismiss'],
    example: 'delete_content',
  })
  @IsOptional()
  @IsString()
  action?: string;
}
