import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsString,
} from 'class-validator';

/**
 * Data transfer object for user sign-in credentials.
 */
export class SignInUserDto {
  /**
   * User account email address.
   * @example 'mario.rossi@example.com'
   */
  @ApiProperty({
    description: 'Registered user email address',
    example: 'mario.rossi@example.com',
    maxLength: 255,
  })
  @IsEmail()
  @IsNotEmpty({ message: 'The email can not be empty' })
  @MaxLength(255)
  email: string;

  /**
   * User account password.
   * @example 'SuperSecret123!'
   */
  @ApiProperty({
    description: 'User account password (minimum 9 characters)',
    example: 'SuperSecret123!',
    minLength: 9,
  })
  @IsNotEmpty({ message: 'The password cannot be empty' })
  @IsString()
  @MinLength(9, { message: 'The password must have at least 9 character' })
  password: string;
}
