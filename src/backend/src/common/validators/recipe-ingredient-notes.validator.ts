import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  MAX_INGREDIENT_NOTES_LENGTH,
  SUPPORTED_LOCALES,
} from './validation-constants';

const ALLOWED_LOCALES = new Set<string>(SUPPORTED_LOCALES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Normalizes optional ingredient preparation notes:
 * - Trims string notes and resolves blank strings to `null`.
 * - For non-empty plain objects, trims string entries and drops blank entries for supported
 *   locales (returning `null` only if all provided supported-locale entries were blank).
 * - Preserves empty `{}` and invalid types/keys so the validator rejects them with 400.
 */
export function normalizeIngredientNotes({
  value,
}: {
  value: unknown;
}): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return value;
    }
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of entries) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed.length === 0 && ALLOWED_LOCALES.has(key)) {
          continue;
        }
        normalized[key] = trimmed;
      } else {
        normalized[key] = entry;
      }
    }
    return Object.keys(normalized).length === 0 ? null : normalized;
  }

  return value;
}

@ValidatorConstraint({ name: 'isIngredientNotes', async: false })
export class IsIngredientNotesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === null || value === undefined) {
      return true;
    }
    if (typeof value === 'string') {
      return value.length > 0 && value.length <= MAX_INGREDIENT_NOTES_LENGTH;
    }
    if (!isPlainObject(value)) {
      return false;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
      return false;
    }

    return entries.every(
      ([key, entry]) =>
        ALLOWED_LOCALES.has(key) &&
        typeof entry === 'string' &&
        entry.length > 0 &&
        entry.length <= MAX_INGREDIENT_NOTES_LENGTH,
    );
  }

  defaultMessage(): string {
    return `Ingredient notes must be a string (max ${MAX_INGREDIENT_NOTES_LENGTH} characters) or a non-empty locale dictionary with keys it, en, fr and string values (max ${MAX_INGREDIENT_NOTES_LENGTH} characters)`;
  }
}

export function IsIngredientNotes(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIngredientNotesConstraint,
    });
  };
}
