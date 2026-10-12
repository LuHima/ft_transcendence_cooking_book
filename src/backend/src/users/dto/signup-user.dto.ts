import { ApiProperty } from '@nestjs/swagger';
import {
  Matches,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

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
    pattern: '^[a-zA-Z0-9_-]+$',
  })
  @IsString()
  @IsNotEmpty({ message: 'The username cannot be empty' })
  @MinLength(3, { message: 'Username must be at least 3 characters long' })
  @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Username can only contain letters, numbers, underscores and hyphens',
  })
  username: string;

  /**
   * User email address.
   * @example 'mario.rossi@example.com'
   */
  @ApiProperty({
    description: 'Valid email address',
    example: 'mario.rossi@example.com',
    maxLength: 255,
  })
  @IsEmail()
  @IsNotEmpty({ message: 'The email can not be empty' })
  @MaxLength(255)
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
  @IsNotEmpty({ message: 'The password cannot be empty' })
  @IsString()
  @MinLength(9, { message: 'The password must have at least 9 character' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W_]).+$/, {
    message:
      'Password is too weak (needs uppercase, lowercase, and a number or symbol)',
  })
  password: string;
}
