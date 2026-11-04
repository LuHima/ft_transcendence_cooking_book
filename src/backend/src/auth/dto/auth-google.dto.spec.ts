import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GoogleAuthDto } from './auth-google.dto';

describe('GoogleAuthDto', () => {
  it('passes validation with a valid non-empty idToken string', async () => {
    const rawDto = {
      idToken: 'valid-google-id-token-xyz',
    };
    const dtoInstance = plainToInstance(GoogleAuthDto, rawDto);
    const errors = await validate(dtoInstance);

    expect(errors.length).toBe(0);
    expect(dtoInstance.idToken).toBe('valid-google-id-token-xyz');
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
