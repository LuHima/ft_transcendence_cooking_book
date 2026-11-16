import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimLowerCase } from '../../common/dto/string-transforms';
import { VALIDATION_MESSAGES } from '../../common/validators/validation-constants';

/**
 * Data transfer object for user sign-in credentials.
 */
export class SignInUserDto {
  /**
   * User account email address.
   * @example 'mario.rossi@example.com'
   */
  @ApiProperty({
    type: String,
    format: 'email',
    description: 'Registered user email address',
    example: 'mario.rossi@example.com',
    maxLength: 255,
  })
  @Transform(trimLowerCase)
  @IsNotEmpty({ message: VALIDATION_MESSAGES.emailEmpty })
  @IsEmail({}, { message: VALIDATION_MESSAGES.emailFormat })
  @MaxLength(255, { message: VALIDATION_MESSAGES.emailMax })
  email: string;

  /**
   * User account password.
   * @example 'SuperSecret123!'
   */
  @ApiProperty({
    type: String,
    description: 'User account password (minimum 9 characters)',
    example: 'SuperSecret123!',
    minLength: 9,
    maxLength: 72,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.passwordEmpty })
  @IsString({ message: VALIDATION_MESSAGES.passwordType })
  @MinLength(9, { message: VALIDATION_MESSAGES.passwordMin })
  @MaxLength(72, { message: VALIDATION_MESSAGES.passwordMax })
  password: string;
}
