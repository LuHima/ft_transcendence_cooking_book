import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEmail, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Data transfer object for updating current user profile details.
 */
export class UpdateUserDto {
	/**
	 * Unique username (3-30 characters).
	 * @example 'mario_rossi_updated'
	 */
	@ApiPropertyOptional({
		description: 'Updated username (3-30 characters)',
		example: 'mario_rossi_updated',
		minLength: 3,
		maxLength: 30,
	})
	@IsOptional()
	@IsString()
	@MinLength(3)
	@MaxLength(30)
	username?: string;

	/**
	 * User email address.
	 * @example 'mario.updated@example.com'
	 */
	@ApiPropertyOptional({
		description: 'Updated email address',
		example: 'mario.updated@example.com',
	})
	@IsOptional()
	@Transform(({ value }) =>
		typeof value === 'string' ? value.trim().toLowerCase() : value,
	)
	@IsEmail()
	email?: string;

	/**
	 * User first name.
	 * @example 'Mario'
	 */
	@ApiPropertyOptional({
		description: 'First name',
		example: 'Mario',
		maxLength: 100,
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	first_name?: string;

	/**
	 * User last name.
	 * @example 'Rossi'
	 */
	@ApiPropertyOptional({
		description: 'Last name',
		example: 'Rossi',
		maxLength: 100,
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	last_name?: string;

	/**
	 * User date of birth.
	 * @example '1995-05-20'
	 */
	@ApiPropertyOptional({
		description: 'Date of birth (ISO 8601 date string or timestamp)',
		example: '1995-05-20',
	})
	@IsOptional()
	birth_date?: string | Date;

	/**
	 * Contact telephone number.
	 * @example '+39 06 1234567'
	 */
	@ApiPropertyOptional({
		description: 'Contact phone number',
		example: '+39 06 1234567',
		maxLength: 30,
	})
	@IsOptional()
	@IsString()
	@MaxLength(30)
	phone?: string;

	/**
	 * Residential street address.
	 * @example 'Via Roma 123'
	 */
	@ApiPropertyOptional({
		description: 'Residential street address',
		example: 'Via Roma 123',
		maxLength: 255,
	})
	@IsOptional()
	@IsString()
	@MaxLength(255)
	address?: string;

	/**
	 * City of residence.
	 * @example 'Roma'
	 */
	@ApiPropertyOptional({
		description: 'City of residence',
		example: 'Roma',
		maxLength: 100,
	})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	city?: string;

	/**
	 * Postal code / ZIP.
	 * @example '00100'
	 */
	@ApiPropertyOptional({
		description: 'Postal code / ZIP',
		example: '00100',
		maxLength: 10,
	})
	@IsOptional()
	@IsString()
	@MaxLength(10)
	postal_code?: string;
}