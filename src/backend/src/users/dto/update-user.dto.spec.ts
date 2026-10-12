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
});
