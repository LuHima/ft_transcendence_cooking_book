import { Matches, IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, MinLength} from 'class-validator';

export class SignUpUserDto
{
 
	@IsString()
	@IsNotEmpty({ message: 'The username cannot be empty' })
	@MinLength(3, { message: 'Username must be at least 3 characters long' })
	@MaxLength(30, { message: 'Username cannot exceed 30 characters' })
	@Matches(/^[a-zA-Z0-9_-]+$/, {message: 'Username can only contain letters, numbers, underscores and hyphens'})
	username: string; 


	@IsEmail()
	@IsNotEmpty(({ message: 'The email can not be empty' }))
	@MaxLength(255)
	email: string;

	@IsNotEmpty(({ message: 'The password cannot be empty' }))
	@IsString()
	@MinLength(9, { message: 'The password must have at least 9 character' })
	@MaxLength(72, { message: 'Password cannot exceed 72 characters' }) 
	@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W_]).+$/, {message: 'Password is too weak (needs uppercase, lowercase, and a number or symbol)'})
	password: string

}
