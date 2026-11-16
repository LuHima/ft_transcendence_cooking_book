/**
 * Shared string and date normalization transforms for DTOs.
 * Non-string inputs are left untouched so downstream class-validator decorators
 * (e.g. @IsString, @IsEmail, @IsDateString) reject invalid types with 400 Bad Request.
 */

export function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Trims string values and resolves empty / whitespace-only strings to `null`
 * so optional database columns store NULL instead of blank strings.
 */
export function trimToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Trims string values and resolves empty / whitespace-only strings to `undefined`
 * for optional query parameters.
 */
export function trimToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function trimLowerCase({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/**
 * Normalizes optional date inputs:
 * - Empty / whitespace strings resolve to `null` (clears optional date fields).
 * - Date instances are converted to ISO 8601 strings (invalid Date -> 'invalid-date').
 * - Non-string values pass through so @IsDateString rejects them with 400.
 */
export function normalizeOptionalDateInput({
  value,
}: {
  value: unknown;
}): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'invalid-date' : value.toISOString();
  }
  return value;
}
