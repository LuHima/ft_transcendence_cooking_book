import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ReportReason, ReportSubject } from '@prisma/client';

/**
 * Payload for submitting a content violation report.
 */
export class CreateReportDto {
  /**
   * Type of entity being reported.
   * @example 'recipe'
   */
  @ApiProperty({
    enum: ReportSubject,
    enumName: 'ReportSubject',
    description: 'Type of entity being reported (recipe, comment, user)',
    example: ReportSubject.recipe,
  })
  @IsEnum(ReportSubject)
  subject: ReportSubject;

  /**
   * Primary key identifier of the reported entity.
   * @example 42
   */
  @ApiProperty({
    description: 'Primary key identifier of the reported item',
    example: 42,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  target_id: number;

  /**
   * Category / justification for the report.
   * @example ReportReason.spam_scam
   */
  @ApiProperty({
    enum: ReportReason,
    enumName: 'ReportReason',
    description: 'Reason category for the report',
    example: ReportReason.spam_scam,
  })
  @IsEnum(ReportReason)
  reason: ReportReason;

  /**
   * Detailed explanation of the violation (maximum 1000 characters).
   * @example 'This post contains repetitive promotional links.'
   */
  @ApiPropertyOptional({
    description:
      'Detailed explanation of the violation (maximum 1000 characters)',
    maxLength: 1000,
    example: 'This post contains repetitive promotional links.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
