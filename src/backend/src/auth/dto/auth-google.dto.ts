import { ApiProperty } from '@nestjs/swagger';
import { MAX_ID_TOKEN_LENGTH } from '../../common/validators/validation-constants';
import { IsGoogleIdToken } from '../validators/google-id-token.validator';

/**
 * Data transfer object for Google OAuth authentication payload.
 */
export class GoogleAuthDto {
  /**
   * Google OAuth2 OpenID Connect ID token (JWT) issued by Google Identity Services.
   * @example 'eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...w'
   */
  @ApiProperty({
    type: String,
    description:
      'Google OAuth2 OpenID Connect ID token (JWT) issued by Google Identity Services',
    maxLength: MAX_ID_TOKEN_LENGTH,
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDk4NzY1NDMyMSIsImVtYWlsIjoibWFyaW8ucm9zc2lAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0.example_signature',
  })
  @IsGoogleIdToken()
  idToken: string;
}
