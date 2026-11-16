import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';
import { ConfirmPasswordDto } from './confirm-password.dto';

const SAMPLE_GOOGLE_JWT =
  'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMDk4NzY1NDMyMSJ9.example_signature';

describe('Auth Re-authentication DTOs', () => {
  describe('ChangePasswordDto', () => {
    it('accepts valid JWT idToken with newPassword', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        idToken: SAMPLE_GOOGLE_JWT,
        newPassword: 'NewSecretPassw0rd!',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects non-JWT idToken and oversized idToken', async () => {
      const invalidJwt = plainToInstance(ChangePasswordDto, {
        idToken: 'plain-string',
        newPassword: 'NewSecretPassw0rd!',
      });
      expect(
        (await validate(invalidJwt)).some((e) => e.property === 'idToken'),
      ).toBe(true);

      const oversized = plainToInstance(ChangePasswordDto, {
        idToken: `${SAMPLE_GOOGLE_JWT}${'a'.repeat(4096)}`,
        newPassword: 'NewSecretPassw0rd!',
      });
      expect(
        (await validate(oversized)).some((e) => e.property === 'idToken'),
      ).toBe(true);
    });
  });

  describe('ConfirmPasswordDto', () => {
    it('accepts valid JWT idToken', async () => {
      const dto = plainToInstance(ConfirmPasswordDto, {
        idToken: SAMPLE_GOOGLE_JWT,
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('rejects non-JWT idToken', async () => {
      const dto = plainToInstance(ConfirmPasswordDto, {
        idToken: 'invalid-token',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'idToken')).toBe(true);
    });
  });
});
