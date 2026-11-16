import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimLowerCase, trimString } from '../../common/dto/string-transforms';
import {
  PASSWORD_REGEX,
  USERNAME_REGEX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

/**
 * Data transfer object for user registration.
 */
export class SignUpUserDto {
  /**
   * Unique username (alphanumeric, underscores, hyphens; 3-30 characters).
   * @example 'mario_rossi'
   */
  @ApiProperty({
    description:
      'Unique username consisting of letters, numbers, underscores, and hyphens (3-30 characters)',
    example: 'mario_rossi',
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
   * User email address.
   * @example 'mario.rossi@example.com'
   */
  @ApiProperty({
    type: String,
    format: 'email',
    description: 'Valid email address',
    example: 'mario.rossi@example.com',
    maxLength: 255,
  })
  @Transform(trimLowerCase)
  @IsNotEmpty({ message: VALIDATION_MESSAGES.emailEmpty })
  @IsEmail({}, { message: VALIDATION_MESSAGES.emailFormat })
  @MaxLength(255, { message: VALIDATION_MESSAGES.emailMax })
  email: string;

  /**
   * Strong user account password (9-72 characters, requiring uppercase, lowercase, and digit/special character).
   * @example 'SecretPassw0rd!'
   */
  @ApiProperty({
    description:
      'Strong password (9-72 chars, must contain uppercase, lowercase, and a number or symbol)',
    example: 'SecretPassw0rd!',
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
}
