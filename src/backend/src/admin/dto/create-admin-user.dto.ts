import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role, UserStatus } from '@prisma/client';
import { IsTrustedAvatarUrl } from '../validators/trusted-avatar-url.validator';
import {
  trimLowerCase,
  trimString,
  trimToNull,
} from '../../common/dto/string-transforms';
import {
  PASSWORD_REGEX,
  USERNAME_REGEX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';
import { UserPersonalDetailsDto } from '../../users/dto/user-personal-details.dto';

/**
 * Data transfer object for administrative user provisioning.
 */
export class CreateAdminUserDto extends UserPersonalDetailsDto {
  /**
   * Unique account username (3-30 characters).
   * @example 'moderator_chef'
   */
  @ApiProperty({
    description:
      'Unique username consisting of letters, numbers, underscores, and hyphens (3-30 characters)',
    example: 'moderator_chef',
    minLength: 3,
    maxLength: 30,
    pattern: USERNAME_REGEX.source,
  })
  @Transform(trimString)
  @IsString({ message: VALIDATION_MESSAGES.usernameType })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.usernameEmpty })
  @MinLength(3, { message: VALIDATION_MESSAGES.usernameMin })
  @MaxLength(30, { message: VALIDATION_MESSAGES.usernameMax })
  @Matches(USERNAME_REGEX, {
    message: VALIDATION_MESSAGES.usernameFormat,
  })
  username: string;

  /**
   * Unique user email address.
   * @example 'moderator@wecook.com'
   */
  @ApiProperty({
    type: String,
    format: 'email',
    description: 'User email address',
    example: 'moderator@wecook.com',
    maxLength: 255,
  })
  @Transform(trimLowerCase)
  @IsNotEmpty({ message: VALIDATION_MESSAGES.emailEmpty })
  @IsEmail({}, { message: VALIDATION_MESSAGES.emailFormat })
  @MaxLength(255, { message: VALIDATION_MESSAGES.emailMax })
  email: string;

  /**
   * Account initial password (9-72 characters, requiring uppercase, lowercase, and digit/special character).
   * @example 'SecurePassword123!'
   */
  @ApiProperty({
    description:
      'Initial plaintext password (9-72 chars, must contain uppercase, lowercase, and a number or symbol)',
    example: 'SecurePassword123!',
    minLength: 9,
    maxLength: 72,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.passwordEmpty })
  @IsString({ message: VALIDATION_MESSAGES.passwordType })
  @MinLength(9, { message: VALIDATION_MESSAGES.passwordMin })
  @MaxLength(72, { message: VALIDATION_MESSAGES.passwordMax })
  @Matches(PASSWORD_REGEX, {
    message: VALIDATION_MESSAGES.passwordStrength,
  })
  password: string;

  /**
   * Assigned administrative or community role.
   * @example Role.moderator
   */
  @ApiProperty({
    enum: Role,
    description: 'Assigned platform role',
    example: Role.moderator,
  })
  @IsNotEmpty({ message: 'Role cannot be empty' })
  @IsEnum(Role, { message: 'Role must be one of: admin, moderator, user' })
  role: Role;

  /**
   * Initial account lifecycle status. Defaults to active.
   * @example UserStatus.active
   */
  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Initial account lifecycle status (defaults to active)',
    example: UserStatus.active,
  })
  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'Status must be one of: active, disabled, banned',
  })
  status?: UserStatus;

  /**
   * Optional initial avatar URL (must be a canonical media route or trusted HTTPS domain).
   * @example '/api/media/avatars/1/default.webp'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Avatar image URL (canonical path /api/media/avatars/* or trusted HTTPS domain)',
    example: '/api/media/avatars/1/default.webp',
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: 'Avatar URL must be a text string' })
  @IsTrustedAvatarUrl()
  avatar_url?: string | null;
}
