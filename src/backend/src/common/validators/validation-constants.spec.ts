import { PHONE_REGEX, POSTAL_CODE_REGEX } from './validation-constants';

describe('validation-constants regexes', () => {
  describe('PHONE_REGEX', () => {
    it.each([
      '+39 06 1234567',
      '+39 333 123 4567',
      '0039 02 1234567',
      '+1 (555) 123-4567',
      '(02) 1234-5678',
      '(+39) 06 1234567',
      '+ 39 06 1234567',
      '06.12.34.56.78',
      '3331234567',
      '+44 20 7946 0958',
    ])('accepts valid phone format: %s', (phone) => {
      expect(PHONE_REGEX.test(phone)).toBe(true);
    });

    it.each([
      'call me maybe',
      '123abc4567',
      '123456',
      '123',
      '-------',
      '+39 (06) 1234567-',
      '-061234567',
      '1234567890123456',
      '06@1234567',
    ])('rejects invalid phone string: %s', (phone) => {
      expect(PHONE_REGEX.test(phone)).toBe(false);
    });
  });

  describe('POSTAL_CODE_REGEX', () => {
    it.each([
      '00100',
      '10001-1234',
      'SW1A 1AA',
      'K1A 0B1',
      '1234 AB',
      '01310-100',
      '00-950',
      'LV-1001',
      'D02 XY45',
      '101',
    ])('accepts valid postal code format: %s', (postalCode) => {
      expect(POSTAL_CODE_REGEX.test(postalCode)).toBe(true);
    });

    it.each([
      '12',
      'Roma',
      'abcdef',
      '00--100',
      '00  100',
      '-00100',
      '00100-',
      '00100!',
      '00100_it',
      '12345678901',
    ])('rejects invalid postal code string: %s', (postalCode) => {
      expect(POSTAL_CODE_REGEX.test(postalCode)).toBe(false);
    });
  });
});
