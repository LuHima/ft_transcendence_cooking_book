import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ReportAction, ReportReason, ReportStatus } from '@prisma/client';
import { validateReportActions } from '../helpers/report-actions.validator';
import { trimToNull } from '../../common/dto/string-transforms';
import { MAX_BAN_DURATION_DAYS } from '../../common/validators/validation-constants';

export { ReportAction };

@ValidatorConstraint({ name: 'ValidReportActions', async: false })
export class ValidReportActionsConstraint implements ValidatorConstraintInterface {
  validate(actions: any, args: ValidationArguments) {
    const obj = args.object as UpdateReportDto;
    return validateReportActions(actions as ReportAction[], obj.status).valid;
  }

  defaultMessage(args: ValidationArguments) {
    const obj = args.object as UpdateReportDto;
    return (
      validateReportActions(args.value as ReportAction[], obj.status).message ??
      'Invalid resolution actions combination'
    );
  }
}

/**
 * Payload for updating moderation report status, executing composite sanctions,
 * and recording dual rationale tracking (user explanation vs staff notes).
 */
export class UpdateReportDto {
  /**
   * New moderation triage status for the report.
   * If omitted, automatically resolves to action_taken (for disciplinary sanctions) or dismissed.
   * @example ReportStatus.action_taken
   */
  @ApiPropertyOptional({
    enum: ReportStatus,
    enumName: 'ReportStatus',
    description: 'Updated report triage status',
    example: ReportStatus.action_taken,
  })
  @IsOptional()
  @IsEnum(ReportStatus, {
    message: 'status must be one of: pending, dismissed, action_taken',
  })
  status?: ReportStatus;

  /**
   * Composite moderation actions applied to the target content and author.
   * @example [ReportAction.delete_content, ReportAction.ban]
   */
  @ApiPropertyOptional({
    description:
      'Composite moderation actions (delete_content, ban, warn, dismiss)',
    enum: ReportAction,
    isArray: true,
    example: [ReportAction.delete_content, ReportAction.ban],
  })
  @IsOptional()
  @IsArray({ message: 'actions must be an array' })
  @IsEnum(ReportAction, {
    each: true,
    message: 'Each action must be one of: delete_content, ban, warn, dismiss',
  })
  @Validate(ValidReportActionsConstraint)
  actions?: ReportAction[];

  /**
   * Canonical violation reason for disciplinary sanctions.
   * Defaults to the report's original reason if omitted.
   * @example ReportReason.harassment_bullying
   */
  @ApiPropertyOptional({
    enum: ReportReason,
    enumName: 'ReportReason',
    description:
      "Formal policy violation category for resolution (defaults to the report's original reason if omitted)",
    example: ReportReason.harassment_bullying,
  })
  @IsOptional()
  @IsEnum(ReportReason, { message: 'Invalid resolution reason category' })
  resolution_reason?: ReportReason;

  /**
   * User-facing explanation communicated to the penalized member.
   * @example 'Your content was removed for violating community safety policies.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'User-facing explanation delivered to the penalized community member (empty resolves to null)',
    maxLength: 1000,
    example:
      'Your content was removed for violating community safety policies.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Resolution description must be a text string' })
  @MaxLength(1000, {
    message: 'Resolution description cannot exceed 1000 characters',
  })
  resolution_description?: string | null;

  /**
   * Internal staff resolution notes documenting findings or peer evaluations.
   * @example 'Content reviewed and removed; user account banned.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Internal staff notes documenting findings or action taken (confidential; empty resolves to null)',
    maxLength: 1000,
    example: 'Content reviewed and removed; user account banned.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Resolution notes must be a text string' })
  @MaxLength(1000, {
    message: 'Resolution notes cannot exceed 1000 characters',
  })
  resolution_notes?: string | null;

  /**
   * Custom ban duration in days (defaults to baseline policy duration if omitted).
   * @example 30
   */
  @ApiPropertyOptional({
    description:
      'Custom ban duration in days (1 to 36500; capped at 180 days for moderators)',
    minimum: 1,
    maximum: MAX_BAN_DURATION_DAYS,
    example: 30,
  })
  @IsOptional()
  @IsInt({ message: 'Ban duration must be a whole number of days' })
  @Min(1, { message: 'Ban duration must be at least 1 day' })
  @Max(MAX_BAN_DURATION_DAYS, {
    message: `Ban duration cannot exceed ${MAX_BAN_DURATION_DAYS} days`,
  })
  ban_duration_days?: number;

  /**
   * Permanent ban flag (Administrator only).
   * @example false
   */
  @ApiPropertyOptional({
    description:
      'Permanent ban flag (default false; restricted to administrators, rejected for moderators)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'permanent must be a boolean value' })
  permanent?: boolean;
}
