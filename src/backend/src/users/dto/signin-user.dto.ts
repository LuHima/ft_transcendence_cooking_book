import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, Length, MaxLength, MinLength} from 'class-validator';

export class SignInUserDto
{
	@IsEmail()
	@IsNotEmpty(({ message: 'The email can not be empty' }))
	@MaxLength(255)
	email: string;

	@IsNotEmpty(({ message: 'The password cannot be empty' }))
	@IsString()
	password: string

/* 	@IsOptional()
	@IsString()
	@Length(6,6)
	twoFactorCode?: string; */
}