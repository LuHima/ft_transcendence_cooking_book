import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, MinLength} from 'class-validator';

export class SignInUserDto
{
	@IsEmail()
	@IsNotEmpty(({ message: 'The email can not be empty' }))
	@MaxLength(255)
	email: string;

	@IsNotEmpty(({ message: 'The password cannot be empty' }))
	@IsString()
<<<<<<< HEAD
	@MinLength(9, { message: 'The password must have at least 9 character' })
=======
>>>>>>> origin/main
	password: string
}