import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength} from 'class-validator';

export class LoginUserDto
{
        @IsEmail()
        @IsNotEmpty(({ message: 'The email can not be empty' }))
        @MaxLength(255)
        email: string;
    
        @IsNotEmpty(({ message: 'The password cannot be empty' }))
        @IsString()
        @MinLength(6, { message: 'The password must have at least 6 character' })
        password: string
}