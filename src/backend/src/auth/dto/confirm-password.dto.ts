import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { SignInUserDto } from '../../users/dto/signin-user.dto';
import { MAX_ID_TOKEN_LENGTH } from '../../common/validators/validation-constants';
import { IsGoogleIdToken } from '../validators/google-id-token.validator';

/**
 * Re-authentication payload accepting either the account password or a Google OpenID Connect ID token.
 */
export class ConfirmPasswordDto extends PartialType(
  PickType(SignInUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({
    description:
      'Google OAuth2 OpenID Connect ID token (required when the account has no local password)',
    maxLength: MAX_ID_TOKEN_LENGTH,
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDk4NzY1NDMyMSJ9.example_signature',
  })
  @IsOptional()
  @IsGoogleIdToken()
  idToken?: string;
}
