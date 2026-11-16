import { applyDecorators } from '@nestjs/common';
import { IsJWT, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_ID_TOKEN_LENGTH } from '../../common/validators/validation-constants';

/**
 * Shared validator bundle for Google OAuth2 OpenID Connect ID tokens (JWT).
 */
export function IsGoogleIdToken() {
  return applyDecorators(
    IsNotEmpty({ message: 'Google ID token cannot be empty' }),
    IsString({ message: 'Google ID token must be a string' }),
    MaxLength(MAX_ID_TOKEN_LENGTH, {
      message: 'Google ID token cannot exceed 4096 characters',
    }),
    IsJWT({ message: 'Google ID token must be a valid JWT' }),
  );
}
