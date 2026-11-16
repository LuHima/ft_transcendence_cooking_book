import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ReportReason, Role, UserStatus } from '@prisma/client';
import { IsTrustedAvatarUrl } from '../validators/trusted-avatar-url.validator';
import {
  trimLowerCase,
  trimString,
  trimToNull,
} from '../../common/dto/string-transforms';
import {
  MAX_BAN_DURATION_DAYS,
  PASSWORD_REGEX,
  USERNAME_REGEX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';
import { UserPersonalDetailsDto } from '../../users/dto/user-personal-details.dto';

/**
 * Data transfer object for administrative user profile, role, status, and credential mutation.
 */
export class UpdateAdminUserDto extends UserPersonalDetailsDto {
  /**
   * Updated unique username (3-30 characters).
   * @example 'moderator_chef_updated'
   */
  @ApiPropertyOptional({
    description:
      'Updated username consisting of letters, numbers, underscores, and hyphens (3-30 characters)',
    example: 'moderator_chef_updated',
    minLength: 3,
    maxLength: 30,
    pattern: USERNAME_REGEX.source,
  })
  @IsOptional()
  @Transform(trimString)
  @IsString({ message: VALIDATION_MESSAGES.usernameType })
  @MinLength(3, { message: VALIDATION_MESSAGES.usernameMin })
  @MaxLength(30, { message: VALIDATION_MESSAGES.usernameMax })
  @Matches(USERNAME_REGEX, {
    message: VALIDATION_MESSAGES.usernameFormat,
  })
  username?: string;

  /**
   * Updated email address.
   * @example 'new.moderator@wecook.com'
   */
  @ApiPropertyOptional({
    type: String,
    format: 'email',
    description: 'Updated email address',
    example: 'new.moderator@wecook.com',
    maxLength: 255,
  })
  @IsOptional()
  @Transform(trimLowerCase)
  @IsEmail({}, { message: VALIDATION_MESSAGES.emailFormat })
  @MaxLength(255, { message: VALIDATION_MESSAGES.emailMax })
  email?: string;

  /**
   * Reset user password (9-72 characters, requiring uppercase, lowercase, and digit/special character).
   * Providing a new password immediately revokes active JWT sessions.
   * @example 'NewSecurePassword456!'
   */
  @ApiPropertyOptional({
    description:
      'Reset password (9-72 chars, must contain uppercase, lowercase, and a number or symbol). Purges active user sessions.',
    example: 'NewSecurePassword456!',
    minLength: 9,
    maxLength: 72,
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.passwordType })
  @MinLength(9, { message: VALIDATION_MESSAGES.passwordMin })
  @MaxLength(72, { message: VALIDATION_MESSAGES.passwordMax })
  @Matches(PASSWORD_REGEX, {
    message: VALIDATION_MESSAGES.passwordStrength,
  })
  password?: string;

  /**
   * Reassigned user role. Modifying role purges active user sessions.
   * Cannot demote self or last administrator.
   * @example Role.admin
   */
  @ApiPropertyOptional({
    enum: Role,
    description:
      'Reassigned role. Demotions or changes immediately purge active sessions.',
    example: Role.admin,
  })
  @IsOptional()
  @IsEnum(Role, { message: 'Role must be one of: admin, moderator, user' })
  role?: Role;

  /**
   * Updated account lifecycle status.
   * Setting to disabled/banned purges active sessions and triggers platform custody.
   * Setting to active triggers atomic content restoration.
   * @example UserStatus.active
   */
  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Account lifecycle status (active, disabled, banned)',
    example: UserStatus.active,
  })
  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'Status must be one of: active, disabled, banned',
  })
  status?: UserStatus;

  /**
   * Violation category when transitioning account status to banned.
   * @example ReportReason.harassment_bullying
   */
  @ApiPropertyOptional({
    enum: ReportReason,
    enumName: 'ReportReason',
    description: 'Violation category when transitioning status to banned',
    example: ReportReason.harassment_bullying,
  })
  @IsOptional()
  @IsEnum(ReportReason, { message: 'Invalid ban reason category' })
  ban_reason?: ReportReason;

  /**
   * User-facing explanation for the ban.
   * @example 'Repeated violations of community conduct policies.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'User-facing explanation for the ban (max 1000 characters)',
    maxLength: 1000,
    example: 'Repeated violations of community conduct policies.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Ban description must be a text string' })
  @MaxLength(1000, {
    message: 'Ban description cannot exceed 1000 characters',
  })
  ban_description?: string | null;

  /**
   * Confidential staff-only internal notes (Admin only, never exposed to the banned user).
   * @example 'Repeat spammer across multiple recipe threads.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Confidential staff-only internal notes (only allowed when status is banned)',
    maxLength: 1000,
    example: 'Repeat spammer across multiple recipe threads.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Internal notes must be a text string' })
  @MaxLength(1000, {
    message: 'Internal notes cannot exceed 1000 characters',
  })
  internal_notes?: string | null;

  /**
   * Explicit ban duration in days (defaults to policy matrix baseline if omitted).
   * @example 30
   */
  @ApiPropertyOptional({
    description: 'Ban duration in days (1 to 36500)',
    example: 30,
    minimum: 1,
    maximum: MAX_BAN_DURATION_DAYS,
  })
  @IsOptional()
  @IsInt({ message: 'Ban duration must be a whole number of days' })
  @Min(1, { message: 'Ban duration must be at least 1 day' })
  @Max(MAX_BAN_DURATION_DAYS, {
    message: `Ban duration cannot exceed ${MAX_BAN_DURATION_DAYS} days`,
  })
  ban_duration_days?: number;

  /**
   * Whether the ban is permanent (Admin only).
   * @example false
   */
  @ApiPropertyOptional({
    description: 'Permanent ban flag',
    example: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_permanent must be a boolean value' })
  is_permanent?: boolean;

  /**
   * Staff audit note explaining why an account was reactivated from banned status.
   * @example 'Ban appeal reviewed and granted by trust & safety staff.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Reason for lifting account ban upon reactivation',
    maxLength: 1000,
    example: 'Ban appeal reviewed and granted by trust & safety staff.',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Unban reason must be a text string' })
  @MaxLength(1000, { message: 'Unban reason cannot exceed 1000 characters' })
  unban_reason?: string | null;

  /**
   * Updated avatar URL (must be a canonical media route or trusted HTTPS domain).
   * @example '/api/media/avatars/1/chef.webp'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Avatar image URL (canonical path /api/media/avatars/* or trusted HTTPS domain)',
    example: '/api/media/avatars/1/chef.webp',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Avatar URL must be a text string' })
  @IsTrustedAvatarUrl()
  avatar_url?: string | null;
}
