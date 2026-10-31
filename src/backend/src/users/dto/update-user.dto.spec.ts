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
});
