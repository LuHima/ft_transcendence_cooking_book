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

export { ReportAction };

@ValidatorConstraint({ name: 'ValidReportActions', async: false })
export class ValidReportActionsConstraint
  implements ValidatorConstraintInterface
{
  validate(actions: any, args: ValidationArguments) {
    if (actions === undefined || actions === null) return true;
    if (!Array.isArray(actions)) return false;

    if (actions.includes(ReportAction.dismiss) && actions.length > 1) {
      return false;
    }

    if (
      actions.includes(ReportAction.warn) &&
      actions.includes(ReportAction.ban)
    ) {
      return false;
    }

    const obj = args.object as UpdateReportDto;
    if (obj.status === ReportStatus.action_taken && actions.length === 0) {
      return false;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const actions = args.value;
    if (Array.isArray(actions)) {
      if (actions.includes(ReportAction.dismiss) && actions.length > 1) {
        return "Action 'dismiss' must stand alone and cannot be combined with other actions";
      }
      if (
        actions.includes(ReportAction.warn) &&
        actions.includes(ReportAction.ban)
      ) {
        return "Actions 'warn' and 'ban' are mutually exclusive and cannot be combined";
      }
    }
    const obj = args.object as UpdateReportDto;
    if (
      obj.status === ReportStatus.action_taken &&
      (!actions || actions.length === 0)
    ) {
      return "Status 'action_taken' requires at least one resolution action";
    }
    return 'Invalid resolution actions combination';
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
      'Permanent ban flag (restricted to administrators, rejected for moderators)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_permanent?: boolean;

  /**
   * Single-action alias for backward compatibility.
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
   * Alternative alias for resolution action (backward compatibility).
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
