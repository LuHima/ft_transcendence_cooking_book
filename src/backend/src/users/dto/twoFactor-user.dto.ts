import { Matches, IsEmail, IsNotEmpty, IsJWT , IsString, IsNumberString, Length} from 'class-validator';

export class TwoFactorAuth
{
	@IsNotEmpty(({message: 'the two factor code cannot be empty'}))
	@Length(6, 6, { message: 'The two factor code must be exactly 6 digits' })
	@IsNumberString({}, { message: 'The two factor code must contain only numbers' })
	code: string;

	@IsNotEmpty(({message: 'the two factor tempToken cannot be empty'}))
	@IsString({ message: 'The tempToken must be a string' })
	@IsJWT({ message: 'The tempToken must be a valid JWT'})
	tempToken: string

}