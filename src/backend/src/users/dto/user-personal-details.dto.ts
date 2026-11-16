import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  normalizeOptionalDateInput,
  trimToNull,
} from '../../common/dto/string-transforms';
import {
  PHONE_REGEX,
  POSTAL_CODE_REGEX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

/**
 * Shared optional personal and demographic profile fields used across
 * self-service profile updates and administrative user management DTOs.
 */
export class UserPersonalDetailsDto {
  /**
   * Culinary biography / cooking philosophy (max 500 characters).
   * @example 'Passionate about authentic Neapolitan pizza and fresh handmade pasta.'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Culinary biography / cooking philosophy (max 500 characters; empty resolves to null)',
    example:
      'Passionate about authentic Neapolitan pizza and fresh handmade pasta.',
    maxLength: 500,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: VALIDATION_MESSAGES.bioType })
  @MaxLength(500, { message: VALIDATION_MESSAGES.bioMax })
  bio?: string | null;

  /**
   * User first name.
   * @example 'Mario'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'First name (max 100 characters; empty resolves to null)',
    example: 'Mario',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: VALIDATION_MESSAGES.firstNameType })
  @MaxLength(100, { message: VALIDATION_MESSAGES.firstNameMax })
  first_name?: string | null;

  /**
   * User last name.
   * @example 'Rossi'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Last name (max 100 characters; empty resolves to null)',
    example: 'Rossi',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: VALIDATION_MESSAGES.lastNameType })
  @MaxLength(100, { message: VALIDATION_MESSAGES.lastNameMax })
  last_name?: string | null;

  /**
   * User date of birth (ISO 8601 date string).
   * @example '1995-05-20'
   */
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    description:
      'Date of birth (strict ISO 8601 date string; empty or null clears the field)',
    example: '1995-05-20',
  })
  @IsOptional()
  @Transform(normalizeOptionalDateInput)
  @IsDateString(
    { strict: true },
    { message: VALIDATION_MESSAGES.birthDateFormat },
  )
  birth_date?: string | Date | null;

  /**
   * Contact telephone number.
   * @example '+39 06 1234567'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Contact phone number (7-15 digits, optional + or parenthesized prefix, spaces/dots/hyphens; empty resolves to null)',
    example: '+39 06 1234567',
    maxLength: 30,
    pattern: PHONE_REGEX.source,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: VALIDATION_MESSAGES.phoneType })
  @MaxLength(30, { message: VALIDATION_MESSAGES.phoneMax })
  @Matches(PHONE_REGEX, { message: VALIDATION_MESSAGES.phoneFormat })
  phone?: string | null;

  /**
   * Residential street address.
   * @example 'Via Roma 123'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Residential street address (max 255 characters; empty resolves to null)',
    example: 'Via Roma 123',
    maxLength: 255,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: VALIDATION_MESSAGES.addressType })
  @MaxLength(255, { message: VALIDATION_MESSAGES.addressMax })
  address?: string | null;

  /**
   * City of residence.
   * @example 'Roma'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'City of residence (max 100 characters; empty resolves to null)',
    example: 'Roma',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: VALIDATION_MESSAGES.cityType })
  @MaxLength(100, { message: VALIDATION_MESSAGES.cityMax })
  city?: string | null;

  /**
   * Postal code / ZIP.
   * @example '00100'
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Postal code / ZIP (3-10 alphanumeric characters with at least one digit and optional single space or hyphen; empty resolves to null)',
    example: '00100',
    minLength: 3,
    maxLength: 10,
    pattern: POSTAL_CODE_REGEX.source,
  })
  @IsOptional()
  @Transform(trimToNull)
  @IsString({ message: VALIDATION_MESSAGES.postalCodeType })
  @MaxLength(10, { message: VALIDATION_MESSAGES.postalCodeMax })
  @Matches(POSTAL_CODE_REGEX, {
    message: VALIDATION_MESSAGES.postalCodeFormat,
  })
  postal_code?: string | null;
}
