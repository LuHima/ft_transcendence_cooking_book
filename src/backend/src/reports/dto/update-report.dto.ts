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
}
