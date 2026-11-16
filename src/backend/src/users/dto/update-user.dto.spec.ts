import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserDto } from './update-user.dto';

describe('UpdateUserDto', () => {
  it('should trim and lowercase email before validation', async () => {
    const rawDto = {
      email: '  CHEF_MARIO@EXAMPLE.COM  ',
    };
    const dtoInstance = plainToInstance(UpdateUserDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBe(0);
    expect(dtoInstance.email).toBe('chef_mario@example.com');
  });

  it('should fail validation on invalid email even after trimming', async () => {
    const rawDto = {
      email: '  not-an-email  ',
    };
    const dtoInstance = plainToInstance(UpdateUserDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should allow valid bio up to 500 characters', async () => {
    const rawDto = {
      bio: 'A'.repeat(500),
    };
    const dtoInstance = plainToInstance(UpdateUserDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBe(0);
    expect(dtoInstance.bio).toBe('A'.repeat(500));
  });

  it('should fail validation when bio exceeds 500 characters', async () => {
    const rawDto = {
      bio: 'A'.repeat(501),
    };
    const dtoInstance = plainToInstance(UpdateUserDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('should fail validation when bio is not a string', async () => {
    const rawDto = {
      bio: 12345 as any,
    };
    const dtoInstance = plainToInstance(UpdateUserDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isString');
  });

  it('should accept valid profile_privacy values', async () => {
    for (const privacy of ['public', 'friends_only', 'private']) {
      const dto = plainToInstance(UpdateUserDto, { profile_privacy: privacy });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.profile_privacy).toBe(privacy);
    }
  });

  it('should reject invalid profile_privacy enum values', async () => {
    const dto = plainToInstance(UpdateUserDto, {
      profile_privacy: 'invalid_tier',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isEnum');
  });

  it('should reject email exceeding 255 characters', async () => {
    const local = 'a'.repeat(245);
    const dtoInstance = plainToInstance(UpdateUserDto, {
      email: `${local}@example.com`,
    });
    const errors = await validate(dtoInstance);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('should enforce username regex and trim whitespace', async () => {
    const validDto = plainToInstance(UpdateUserDto, {
      username: '  mario_rossi-2  ',
    });
    expect(await validate(validDto)).toHaveLength(0);
    expect(validDto.username).toBe('mario_rossi-2');

    for (const invalidUsername of ['mario rossi', 'mario!', '   ', 'ab']) {
      const invalidDto = plainToInstance(UpdateUserDto, {
        username: invalidUsername,
      });
      const errors = await validate(invalidDto);
      expect(errors.length).toBeGreaterThan(0);
    }
  });

  describe('phone and postal_code validation', () => {
    it('accepts valid international phone formats and postal codes', async () => {
      const dto = plainToInstance(UpdateUserDto, {
        phone: '  (+39) 06 123-4567  ',
        postal_code: '  SW1A 1AA  ',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.phone).toBe('(+39) 06 123-4567');
      expect(dto.postal_code).toBe('SW1A 1AA');
    });

    it('rejects arbitrary strings in phone and postal_code with descriptive messages', async () => {
      const dto = plainToInstance(UpdateUserDto, {
        phone: 'not a phone',
        postal_code: 'Roma',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(2);

      const phoneError = errors.find((e) => e.property === 'phone');
      const postalError = errors.find((e) => e.property === 'postal_code');
      expect(phoneError?.constraints?.matches).toContain('7 to 15 digits');
      expect(postalError?.constraints?.matches).toContain('at least one digit');
    });

    it('resolves empty and whitespace-only optional fields to null', async () => {
      const dto = plainToInstance(UpdateUserDto, {
        first_name: '   ',
        last_name: '',
        bio: '  ',
        phone: '',
        address: '   ',
        city: '',
        postal_code: '   ',
        birth_date: '',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.first_name).toBeNull();
      expect(dto.last_name).toBeNull();
      expect(dto.bio).toBeNull();
      expect(dto.phone).toBeNull();
      expect(dto.address).toBeNull();
      expect(dto.city).toBeNull();
      expect(dto.postal_code).toBeNull();
      expect(dto.birth_date).toBeNull();
    });
  });

  describe('birth_date strict ISO validation', () => {
    it('accepts strict ISO dates including historical or future dates and null', async () => {
      for (const birth_date of [
        '1995-05-20',
        '1995-05-20T00:00:00.000Z',
        '1850-01-01',
        '2099-12-31',
        null,
      ]) {
        const dto = plainToInstance(UpdateUserDto, { birth_date });
        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('rejects invalid calendar dates and non-date values', async () => {
      for (const birth_date of ['2026-02-31', 'not-a-date', 12345, true]) {
        const dto = plainToInstance(UpdateUserDto, { birth_date });
        const errors = await validate(dto);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].property).toBe('birth_date');
      }
    });
  });
});
