import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
import { CreateAdminUserDto } from './create-admin-user.dto';
import { UpdateAdminUserDto } from './update-admin-user.dto';

describe('Admin User DTO Validation', () => {
  describe('CreateAdminUserDto', () => {
    const validBase = {
      username: 'moderator_chef',
      email: '  MOD@WeCook.COM ',
      password: 'SecurePassword123!',
      role: Role.moderator,
    };

    it('accepts valid payload with trimmed lowercase email and optional personal fields', async () => {
      const dto = plainToInstance(CreateAdminUserDto, {
        ...validBase,
        phone: '+39 02 1234567',
        postal_code: '20124',
        birth_date: '1990-05-15',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.email).toBe('mod@wecook.com');
    });

    it('rejects username with spaces or special characters', async () => {
      const dto = plainToInstance(CreateAdminUserDto, {
        ...validBase,
        username: 'bad user!',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'username')).toBe(true);
    });

    it('enforces 9-72 password length and complexity matching SignUpUserDto', async () => {
      for (const password of ['Short1!', 'lowercaseonly1!', 'NoNumbersOrSym']) {
        const dto = plainToInstance(CreateAdminUserDto, {
          ...validBase,
          password,
        });
        const errors = await validate(dto);
        expect(errors.some((e) => e.property === 'password')).toBe(true);
      }

      const tooLong = plainToInstance(CreateAdminUserDto, {
        ...validBase,
        password: `Aa1!${'x'.repeat(70)}`,
      });
      expect(
        (await validate(tooLong)).some((e) => e.property === 'password'),
      ).toBe(true);
    });

    it('rejects non-string email instead of turning it into undefined', async () => {
      const dto = plainToInstance(CreateAdminUserDto, {
        ...validBase,
        email: 12345,
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });
  });

  describe('UpdateAdminUserDto', () => {
    it('rejects non-string email instead of bypassing validation', async () => {
      const dto = plainToInstance(UpdateAdminUserDto, { email: 12345 });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'email')).toBe(true);
    });

    it('rejects invalid phone, postal_code, birth_date, and excessive ban_duration_days', async () => {
      const dto = plainToInstance(UpdateAdminUserDto, {
        phone: 'invalid',
        postal_code: 'abc',
        birth_date: '2026-02-30',
        ban_duration_days: 40000,
      });
      const errors = await validate(dto);
      const props = errors.map((e) => e.property);
      expect(props).toContain('phone');
      expect(props).toContain('postal_code');
      expect(props).toContain('birth_date');
      expect(props).toContain('ban_duration_days');
    });

    it('resolves cleared optional strings to null', async () => {
      const dto = plainToInstance(UpdateAdminUserDto, {
        phone: '  ',
        postal_code: '',
        bio: ' ',
        birth_date: '',
        ban_description: ' ',
        internal_notes: '',
        unban_reason: '  ',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.phone).toBeNull();
      expect(dto.postal_code).toBeNull();
      expect(dto.bio).toBeNull();
      expect(dto.birth_date).toBeNull();
      expect(dto.ban_description).toBeNull();
      expect(dto.internal_notes).toBeNull();
      expect(dto.unban_reason).toBeNull();
    });
  });
});
