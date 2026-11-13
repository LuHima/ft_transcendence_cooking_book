import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDk4NzY1NDMyMSIsImVtYWlsIjoibWFyaW8ucm9zc2lAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0.example_signature',
  })
  @IsString()
  @IsNotEmpty({ message: 'Google ID token cannot be empty' })
  idToken: string;
}
