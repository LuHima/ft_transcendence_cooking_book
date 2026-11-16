import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ReportReason, ReportSubject } from '@prisma/client';
import { trimToNull } from '../../common/dto/string-transforms';
import {
  INT32_MAX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

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
  @IsEnum(ReportSubject, {
    message: 'subject must be one of: recipe, comment, user',
  })
  subject: ReportSubject;

  /**
   * Primary key identifier of the reported entity.
   * @example 42
   */
  @ApiProperty({
    description: 'Primary key identifier of the reported item',
    minimum: 1,
    maximum: INT32_MAX,
    example: 42,
  })
  @Type(() => Number)
  @IsInt({ message: VALIDATION_MESSAGES.idRange })
  @Min(1, { message: VALIDATION_MESSAGES.idRange })
  @Max(INT32_MAX, { message: VALIDATION_MESSAGES.idRange })
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
  @IsEnum(ReportReason, { message: 'Invalid report reason category' })
  reason: ReportReason;

  /**
   * Detailed explanation of the violation (maximum 1000 characters).
   * @example 'This post contains repetitive promotional links.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Detailed explanation of the violation (maximum 1000 characters; empty resolves to null)',
    maxLength: 1000,
    example: 'This post contains repetitive promotional links.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Report description must be a text string' })
  @MaxLength(1000, {
    message: 'Report description cannot exceed 1000 characters',
  })
  description?: string | null;
}
