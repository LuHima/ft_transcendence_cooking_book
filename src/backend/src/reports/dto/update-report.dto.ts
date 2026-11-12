import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ReportAction, ReportReason, ReportStatus } from '@prisma/client';
import { validateReportActions } from '../helpers/report-actions.validator';

export { ReportAction };

@ValidatorConstraint({ name: 'ValidReportActions', async: false })
export class ValidReportActionsConstraint
  implements ValidatorConstraintInterface
{
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
  @IsEnum(ReportStatus)
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
  @IsArray()
  @IsEnum(ReportAction, { each: true })
  @Validate(ValidReportActionsConstraint)
  actions?: ReportAction[];

  /**
   * Canonical violation reason for disciplinary sanctions.
   * Mandatory if actions include 'ban', 'delete_content', or 'warn'.
   * @example ReportReason.harassment_bullying
   */
  @ApiPropertyOptional({
    enum: ReportReason,
    enumName: 'ReportReason',
    description: 'Formal policy violation category for resolution',
    example: ReportReason.harassment_bullying,
  })
  @IsOptional()
  @IsEnum(ReportReason)
  resolution_reason?: ReportReason;

  /**
   * User-facing explanation communicated to the penalized member.
   * @example 'Your content was removed for violating community safety policies.'
   */
  @ApiPropertyOptional({
    description:
      'User-facing explanation delivered to the penalized community member',
    maxLength: 1000,
    example:
      'Your content was removed for violating community safety policies.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution_description?: string;

  /**
   * Internal staff resolution notes documenting findings or peer evaluations.
   * @example 'Content reviewed and removed; user account banned.'
   */
  @ApiPropertyOptional({
    description:
      'Internal staff notes documenting findings or action taken (confidential)',
    maxLength: 1000,
    example: 'Content reviewed and removed; user account banned.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  resolution_notes?: string;

  /**
   * Custom ban duration in days (defaults to baseline policy duration if omitted).
   * @example 30
   */
  @ApiPropertyOptional({
    description:
      'Custom ban duration in days (capped at 180 days for moderators)',
    minimum: 1,
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
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
  @IsBoolean()
  permanent?: boolean;

  /**
   * Permanent ban flag alias (Administrator only).
   * @example false
   */
  @ApiPropertyOptional({
    description:
      'Permanent ban flag alias (restricted to administrators, rejected for moderators)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_permanent?: boolean;
}
