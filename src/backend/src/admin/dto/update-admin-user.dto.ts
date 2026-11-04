import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ReportReason, Role, UserStatus } from '@prisma/client';
import { IsTrustedAvatarUrl } from '../validators/trusted-avatar-url.validator';

/**
 * Data transfer object for administrative user profile, role, status, and credential mutation.
 */
export class UpdateAdminUserDto {
  /**
   * Updated unique username (3-30 characters).
   * @example 'moderator_chef_updated'
   */
  @ApiPropertyOptional({
    description: 'Updated username (3-30 characters)',
    example: 'moderator_chef_updated',
    minLength: 3,
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username?: string;

  /**
   * Updated email address.
   * @example 'new.moderator@wecook.com'
   */
  @ApiPropertyOptional({
    description: 'Updated email address',
    example: 'new.moderator@wecook.com',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : undefined,
  )
  @IsEmail()
  email?: string;

  /**
   * Reset user password (minimum 8 characters).
   * Providing a new password immediately revokes active JWT sessions.
   * @example 'NewSecurePassword456!'
   */
  @ApiPropertyOptional({
    description:
      'Reset password (minimum 8 characters). Purges active user sessions.',
    example: 'NewSecurePassword456!',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
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
  @IsEnum(Role)
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
  @IsEnum(UserStatus)
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
  @IsEnum(ReportReason)
  ban_reason?: ReportReason;

  /**
   * User-facing explanation for the ban.
   * @example 'Repeated violations of community conduct policies.'
   */
  @ApiPropertyOptional({
    description: 'User-facing explanation for the ban',
    maxLength: 1000,
    example: 'Repeated violations of community conduct policies.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  ban_description?: string;

  /**
   * Explicit ban duration in days (defaults to policy matrix baseline if omitted).
   * @example 30
   */
  @ApiPropertyOptional({
    description: 'Ban duration in days',
    example: 30,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
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
  @IsBoolean()
  is_permanent?: boolean;

  /**
   * Staff audit note explaining why an account was reactivated from banned status.
   * @example 'Ban appeal reviewed and granted by trust & safety staff.'
   */
  @ApiPropertyOptional({
    description: 'Reason for lifting account ban upon reactivation',
    maxLength: 1000,
    example: 'Ban appeal reviewed and granted by trust & safety staff.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  unban_reason?: string;

  /**
   * Updated avatar URL (must be a local upload path or trusted HTTPS domain).
   * @example '/uploads/avatars/chef.webp'
   */
  @ApiPropertyOptional({
    description:
      'Avatar image URL (local path /uploads/avatars/* or trusted HTTPS domain)',
    example: '/uploads/avatars/chef.webp',
  })
  @IsOptional()
  @IsString()
  @IsTrustedAvatarUrl()
  avatar_url?: string;

  /**
   * Culinary biography / staff notes (maximum 500 characters).
   * @example 'Senior community moderator and culinary instructor.'
   */
  @ApiPropertyOptional({
    description: 'Culinary biography / description (maximum 500 characters)',
    example: 'Senior community moderator and culinary instructor.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  /**
   * Member first name.
   * @example 'Luca'
   */
  @ApiPropertyOptional({
    description: 'First name',
    example: 'Luca',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  /**
   * Member last name.
   * @example 'Bianchi'
   */
  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Bianchi',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  /**
   * Date of birth (ISO 8601 string or Date).
   * @example '1990-05-15'
   */
  @ApiPropertyOptional({
    description: 'Date of birth (ISO 8601 date string)',
    example: '1990-05-15',
  })
  @IsOptional()
  birth_date?: string | Date;

  /**
   * Contact phone number.
   * @example '+39 02 1234567'
   */
  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '+39 02 1234567',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /**
   * Street address.
   * @example 'Corso Buenos Aires 45'
   */
  @ApiPropertyOptional({
    description: 'Residential address',
    example: 'Corso Buenos Aires 45',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  /**
   * City of residence.
   * @example 'Milano'
   */
  @ApiPropertyOptional({
    description: 'City of residence',
    example: 'Milano',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /**
   * Postal code.
   * @example '20124'
   */
  @ApiPropertyOptional({
    description: 'Postal code / ZIP',
    example: '20124',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postal_code?: string;
}
