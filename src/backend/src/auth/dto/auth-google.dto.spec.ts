import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GoogleAuthDto } from './auth-google.dto';

const SAMPLE_GOOGLE_JWT =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDk4NzY1NDMyMSIsImVtYWlsIjoibWFyaW8ucm9zc2lAZXhhbXBsZS5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZX0.example_signature';

describe('GoogleAuthDto', () => {
  it('passes validation with a valid Google JWT idToken', async () => {
    const rawDto = {
      idToken: SAMPLE_GOOGLE_JWT,
    };
    const dtoInstance = plainToInstance(GoogleAuthDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBe(0);
    expect(dtoInstance.idToken).toBe(SAMPLE_GOOGLE_JWT);
  });

  it('fails validation when idToken is not a valid JWT', async () => {
    const dtoInstance = plainToInstance(GoogleAuthDto, {
      idToken: 'valid-google-id-token-xyz',
    });
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isJwt');
  });

  it('fails validation when idToken exceeds 4096 characters', async () => {
    const dtoInstance = plainToInstance(GoogleAuthDto, {
      idToken: `${SAMPLE_GOOGLE_JWT}${'a'.repeat(4096)}`,
    });
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('fails validation when idToken is empty string', async () => {
    const rawDto = {
      idToken: '',
    };
    const dtoInstance = plainToInstance(GoogleAuthDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('fails validation when idToken is missing', async () => {
    const rawDto = {};
    const dtoInstance = plainToInstance(GoogleAuthDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('fails validation when idToken is not a string', async () => {
    const rawDto = {
      idToken: 12345,
    };
    const dtoInstance = plainToInstance(GoogleAuthDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isString');
  });
});
