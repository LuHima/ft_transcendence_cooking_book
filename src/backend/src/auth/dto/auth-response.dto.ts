import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * Generic success message response.
 */
export class AuthMessageResponseDto {
  /**
   * Informative message describing the outcome of the operation.
   * @example 'Authentication append with success'
   */
  @ApiProperty({
    description: 'Informative message describing the outcome of the operation',
    example: 'Authentication append with success',
  })
  message: string;
}

/**
 * Response returned when sign-in requires second-factor authentication.
 */
export class TwoFactorChallengeResponseDto {
  /**
   * Temporary JWT token used to complete 2FA verification.
   * @example 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
   */
  @ApiProperty({
    description: 'Temporary JWT token to exchange in /auth/twofactor/access',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  tempToken: string;

  /**
   * Boolean flag indicating 2FA challenge is required.
   * @example true
   */
  @ApiProperty({
    description: 'Flag indicating two-factor verification is required',
    example: true,
  })
  twofAuth: true;
}

/**
 * Response returned upon successful user registration.
 */
export class SignUpResponseDto {
  /**
   * Unique user identifier.
   * @example 1
   */
  @ApiProperty({
    description: 'Unique user identifier',
    example: 1,
  })
  id: number;

  /**
   * Unique username of the registered user.
   * @example 'mario_rossi'
   */
  @ApiProperty({
    description: 'Unique username of the registered user',
    example: 'mario_rossi',
  })
  username: string;

  /**
   * Email address of the user.
   * @example 'mario.rossi@example.com'
   */
  @ApiProperty({
    description: 'Email address of the user',
    example: 'mario.rossi@example.com',
  })
  email: string;

  /**
   * System role assigned to the user.
   * @example Role.user
   */
  @ApiProperty({
    description: 'System role assigned to the user',
    enum: Role,
    example: Role.user,
  })
  role: Role;

  /**
   * Account creation timestamp.
   * @example '2026-10-09T18:00:00.000Z'
   */
  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2026-10-09T18:00:00.000Z',
  })
  created_at: Date;
}

/**
 * Response returned when initiating two-factor authentication setup.
 */
export class TwoFactorEnableResponseDto {
  /**
   * Data URL representation of the QR code to scan with an authenticator app.
   * @example 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
   */
  @ApiProperty({
    description: 'Data URI representation of the QR code containing OTP auth URI',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
  })
  qrCode: string;

  /**
   * Base32 secret key for manual entry into authenticator apps.
   * @example 'JBSWY3DPEHPK3PXP'
   */
  @ApiProperty({
    description: 'Base32 secret key for manual entry in authenticator application',
    example: 'JBSWY3DPEHPK3PXP',
  })
  key: string;
}
