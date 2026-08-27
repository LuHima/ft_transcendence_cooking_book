import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength, MinLength} from 'class-validator';

export class registerUserDto
{
    @IsString()
    @IsNotEmpty({ message: 'The username cannot be empty' })
    @MinLength(3, { message: 'Username must be at least 3 characters long' })
    @MaxLength(30, { message: 'Username cannot exceed 30 characters' })
    username: string;

    @IsEmail()
    @IsNotEmpty(({ message: 'The email can not be empty' }))
    @MaxLength(255)
    email: string;

    @IsNotEmpty(({ message: 'The password cannot be empty' }))
    @IsString()
    @MinLength(6, { message: 'The password must have at least 6 character' })
    password: string

    @IsUrl()
    @IsString()
    @IsOptional()
    @MaxLength(255)
    avatar_url: string | null;
}