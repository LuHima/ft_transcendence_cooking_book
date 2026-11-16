import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ReportStatus, ReportSubject } from '@prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { LocaleQueryDto } from 'src/common/dto/locale-query.dto';
import { transformOptionalInt } from 'src/common/dto/query-transforms';
import {
  INT32_MAX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

@ValidatorConstraint({ name: 'isTargetIdWithSubject', async: false })
export class IsTargetIdWithSubjectConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    if (value === undefined || value === null) {
      return true;
    }
    const obj = args.object as { subject?: ReportSubject };
    return Boolean(obj?.subject);
  }

  defaultMessage(): string {
    return 'subject must be specified when target_id is provided';
  }
}

export function IsTargetIdWithSubject(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTargetIdWithSubject',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: IsTargetIdWithSubjectConstraint,
    });
  };
}

/**
 * Query filters for the administrative moderation reports queue.
 */
export class ReportQueryDto extends IntersectionType(
  PaginationQueryDto,
  LocaleQueryDto,
) {
  /**
   * Filter reports by current review status.
   * @example 'pending'
   */
  @ApiPropertyOptional({
    enum: ReportStatus,
    enumName: 'ReportStatus',
    description: 'Filter reports by current review status',
    example: ReportStatus.pending,
  })
  @IsOptional()
  @IsEnum(ReportStatus, {
    message: 'status must be one of: pending, dismissed, action_taken',
  })
  status?: ReportStatus;

  /**
   * Filter reports by target subject entity type.
   * @example 'recipe'
   */
  @ApiPropertyOptional({
    enum: ReportSubject,
    enumName: 'ReportSubject',
    description: 'Filter reports by target entity type',
    example: ReportSubject.recipe,
  })
  @IsOptional()
  @IsEnum(ReportSubject, {
    message: 'subject must be one of: recipe, comment, user',
  })
  subject?: ReportSubject;

  /**
   * Filter reports by target entity ID (requires subject).
   * @example 42
   */
  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: INT32_MAX,
    description:
      'Filter reports by target entity ID (requires subject to prevent polymorphic ID collisions)',
    example: 42,
  })
  @IsOptional()
  @Transform(transformOptionalInt)
  @IsInt({ message: VALIDATION_MESSAGES.idRange })
  @Min(1, { message: VALIDATION_MESSAGES.idRange })
  @Max(INT32_MAX, { message: VALIDATION_MESSAGES.idRange })
  @IsTargetIdWithSubject()
  target_id?: number;
}
