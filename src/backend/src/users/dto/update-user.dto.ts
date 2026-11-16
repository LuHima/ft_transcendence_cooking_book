import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProfilePrivacy } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { trimLowerCase, trimString } from '../../common/dto/string-transforms';
import {
  USERNAME_REGEX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';
import { UserPersonalDetailsDto } from './user-personal-details.dto';

/**
 * Data transfer object for updating current user profile details.
 */
export class UpdateUserDto extends UserPersonalDetailsDto {
  /**
   * Profile privacy visibility tier.
   * @example ProfilePrivacy.public
   */
  @ApiPropertyOptional({
    enum: ProfilePrivacy,
    description: 'Profile privacy setting (public, friends_only, private)',
    example: ProfilePrivacy.public,
  })
  @IsOptional()
  @IsEnum(ProfilePrivacy, {
    message: VALIDATION_MESSAGES.profilePrivacyEnum,
  })
  profile_privacy?: ProfilePrivacy;

  /**
   * Unique username (3-30 characters).
   * @example 'mario_rossi_updated'
   */
  @ApiPropertyOptional({
    description:
      'Updated username consisting of letters, numbers, underscores, and hyphens (3-30 characters)',
    example: 'mario_rossi_updated',
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
   * User email address.
   * @example 'mario.updated@example.com'
   */
  @ApiPropertyOptional({
    type: String,
    format: 'email',
    description: 'Updated email address',
    example: 'mario.updated@example.com',
    maxLength: 255,
  })
  @IsOptional()
  @Transform(trimLowerCase)
  @IsEmail({}, { message: VALIDATION_MESSAGES.emailFormat })
  @MaxLength(255, { message: VALIDATION_MESSAGES.emailMax })
  email?: string;
}
