import { IsOptional, IsString, IsEmail, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateUserDto {
	@IsOptional()
	@IsString()
	@MinLength(3)
	@MaxLength(30)
	username?: string;

	@IsOptional()
	@Transform(({ value }) =>
		typeof value === 'string' ? value.trim().toLowerCase() : value,
	)
	@IsEmail()
	email?: string;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	first_name?: string;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	last_name?: string;

	@IsOptional()
	birth_date?: string | Date;

	@IsOptional()
	@IsString()
	@MaxLength(30)
	phone?: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	address?: string;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	city?: string;

	@IsOptional()
	@IsString()
	@MaxLength(10)
	postal_code?: string;
}