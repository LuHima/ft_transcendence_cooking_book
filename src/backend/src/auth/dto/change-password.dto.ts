import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  MAX_ID_TOKEN_LENGTH,
  PASSWORD_REGEX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';
import { IsGoogleIdToken } from '../validators/google-id-token.validator';

/**
 * Data transfer object for setting or changing the current user's password.
 */
export class ChangePasswordDto {
  /**
   * Current account password (required when the account already has a password).
   * @example 'CurrentPassw0rd!'
   */
  @ApiPropertyOptional({
    description:
      'Current account password (alternative to `idToken` when the account already has a password)',
    example: 'CurrentPassw0rd!',
    minLength: 9,
    maxLength: 72,
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.passwordType })
  @MinLength(9, { message: VALIDATION_MESSAGES.passwordMin })
  @MaxLength(72, { message: VALIDATION_MESSAGES.passwordMax })
  currentPassword?: string;

  /**
   * Google OAuth2 OpenID Connect ID token (required when setting a password on an OAuth-only account).
   */
  @ApiPropertyOptional({
    description:
      'Google OAuth2 OpenID Connect ID token (required when the account has no local password)',
    maxLength: MAX_ID_TOKEN_LENGTH,
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDk4NzY1NDMyMSJ9.example_signature',
  })
  @IsOptional()
  @IsGoogleIdToken()
  idToken?: string;

  /**
   * New strong account password (9-72 characters, requiring uppercase, lowercase, and digit/special character).
   * @example 'NewSecretPassw0rd!'
   */
  @ApiProperty({
    description:
      'New strong password (9-72 chars, must contain uppercase, lowercase, and a number or symbol)',
    example: 'NewSecretPassw0rd!',
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
  newPassword: string;
}
