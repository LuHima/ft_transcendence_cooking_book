import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SignUpUserDto } from './signup-user.dto';
import { SignInUserDto } from './signin-user.dto';

describe('SignUpUserDto & SignInUserDto', () => {
  it('trims username and trims + lowercases email on SignUpUserDto', async () => {
    const dto = plainToInstance(SignUpUserDto, {
      username: '  mario_rossi  ',
      email: '  Mario.Rossi@Example.COM  ',
      password: 'SecretPassw0rd!',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.username).toBe('mario_rossi');
    expect(dto.email).toBe('mario.rossi@example.com');
  });

  it('trims and lowercases email on SignInUserDto', async () => {
    const dto = plainToInstance(SignInUserDto, {
      email: '  Mario@Example.COM  ',
      password: 'SuperSecret123!',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('mario@example.com');
  });

  it('uses grammatically clean error messages on SignUpUserDto', async () => {
    const dto = plainToInstance(SignUpUserDto, {
      username: '',
      email: '',
      password: 'short',
    });
    const errors = await validate(dto);
    const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
    expect(messages).toContain('The email cannot be empty');
    expect(messages).toContain('The password must have at least 9 characters');
  });
});
