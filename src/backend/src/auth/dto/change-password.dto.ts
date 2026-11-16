import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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
  })
  @IsOptional()
  @IsString()
  @MinLength(9, { message: 'The password must have at least 9 character' })
  currentPassword?: string;

  /**
   * Google OAuth2 OpenID Connect ID token (required when setting a password on an OAuth-only account).
   */
  @ApiPropertyOptional({
    description:
      'Google OAuth2 OpenID Connect ID token (required when the account has no local password)',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Google ID token cannot be empty' })
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
  @IsNotEmpty({ message: 'The password cannot be empty' })
  @IsString()
  @MinLength(9, { message: 'The password must have at least 9 character' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W_]).+$/, {
    message:
      'Password is too weak (needs uppercase, lowercase, and a number or symbol)',
  })
  newPassword: string;
}
