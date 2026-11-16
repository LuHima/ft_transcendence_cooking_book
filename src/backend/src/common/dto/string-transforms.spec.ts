import { plainToInstance } from 'class-transformer';
import {
  normalizeOptionalDateInput,
  trimLowerCase,
  trimString,
  trimToNull,
  trimToUndefined,
} from './string-transforms';

describe('string-transforms', () => {
  describe('trimString', () => {
    it('trims leading and trailing whitespace on strings', () => {
      expect(trimString({ value: '  hello world  ' })).toBe('hello world');
    });

    it('preserves non-string values for downstream type validators', () => {
      expect(trimString({ value: 123 })).toBe(123);
      expect(trimString({ value: null })).toBeNull();
      expect(trimString({ value: undefined })).toBeUndefined();
    });
  });

  describe('trimToNull', () => {
    it('returns trimmed string for non-empty strings', () => {
      expect(trimToNull({ value: '  Roma  ' })).toBe('Roma');
    });

    it('resolves empty and whitespace-only strings to null', () => {
      expect(trimToNull({ value: '' })).toBeNull();
      expect(trimToNull({ value: '   \t\n ' })).toBeNull();
    });

    it('preserves non-string values for downstream validation', () => {
      expect(trimToNull({ value: 42 })).toBe(42);
      expect(trimToNull({ value: null })).toBeNull();
      expect(trimToNull({ value: undefined })).toBeUndefined();
    });
  });

  describe('trimToUndefined', () => {
    it('returns trimmed string for non-empty strings and undefined for blank strings', () => {
      expect(trimToUndefined({ value: '  pasta  ' })).toBe('pasta');
      expect(trimToUndefined({ value: '' })).toBeUndefined();
      expect(trimToUndefined({ value: '   ' })).toBeUndefined();
    });

    it('preserves non-string values so @IsString rejects arrays/numbers', () => {
      expect(trimToUndefined({ value: ['a', 'b'] })).toEqual(['a', 'b']);
      expect(trimToUndefined({ value: 123 })).toBe(123);
    });
  });

  describe('trimLowerCase', () => {
    it('trims and lowercases strings while preserving non-strings', () => {
      expect(trimLowerCase({ value: '  Chef@Example.COM  ' })).toBe(
        'chef@example.com',
      );
      expect(trimLowerCase({ value: 123 })).toBe(123);
    });
  });

  describe('normalizeOptionalDateInput', () => {
    it('converts empty or whitespace strings to null', () => {
      expect(normalizeOptionalDateInput({ value: '' })).toBeNull();
      expect(normalizeOptionalDateInput({ value: '   ' })).toBeNull();
    });

    it('trims ISO date strings', () => {
      expect(normalizeOptionalDateInput({ value: ' 1995-05-20 ' })).toBe(
        '1995-05-20',
      );
    });

    it('converts valid Date instances to ISO strings and invalid Date to invalid-date', () => {
      expect(
        normalizeOptionalDateInput({ value: new Date('1995-05-20T00:00:00Z') }),
      ).toBe('1995-05-20T00:00:00.000Z');
      expect(normalizeOptionalDateInput({ value: new Date('invalid') })).toBe(
        'invalid-date',
      );
    });

    it('preserves non-string non-Date values so @IsDateString rejects them', () => {
      expect(normalizeOptionalDateInput({ value: 12345 })).toBe(12345);
      expect(normalizeOptionalDateInput({ value: true })).toBe(true);
      expect(normalizeOptionalDateInput({ value: null })).toBeNull();
      expect(normalizeOptionalDateInput({ value: undefined })).toBeUndefined();
    });

    it('works inside class-transformer plainToInstance', () => {
      class Demo {
        value?: string | null;
      }
      expect(plainToInstance(Demo, { value: '' }).value).toBe('');
    });
  });
});
