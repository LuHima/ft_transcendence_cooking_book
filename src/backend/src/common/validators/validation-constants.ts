/**
 * Shared DTO validation regex patterns, numeric bounds, and user-facing error messages.
 */

export const INT32_MAX = 2147483647;

export const SUPPORTED_LOCALES = ['it', 'en', 'fr'] as const;

export const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W_]).+$/;

/**
 * General international phone regex allowing optional leading '+', parenthesized area/country codes
 * like (02) or (+39), spaces, dots, and hyphens, requiring 7 to 15 digits total.
 */
export const PHONE_REGEX =
  /^(?=(?:\D*\d){7,15}\D*$)(?:\+\s?)?(?:\(\+?\d{1,5}\)|\d)[\d\s().-]*\d$/;

/**
 * General international postal code regex (3 to 10 characters, at least one digit,
 * ASCII letters/digits with optional single spaces or hyphens between characters).
 */
export const POSTAL_CODE_REGEX =
  /^(?=.*\d)[A-Za-z0-9](?:[A-Za-z0-9]|[- ](?=[A-Za-z0-9])){1,8}[A-Za-z0-9]$/;

export const MAX_RECIPE_TIME_MINUTES = 8760;
export const MAX_TOTAL_TIME_MINUTES = 17520;
export const MAX_SERVINGS = 1000;
export const MAX_STEP_NUMBER = 100;
export const MAX_RECIPE_STEPS = 50;
export const MAX_RECIPE_INGREDIENTS = 100;
export const MAX_RECIPE_TAGS = 30;
export const MAX_FILTER_IDS = 50;
export const MAX_BAN_DURATION_DAYS = 36500;
export const MIN_INGREDIENT_QUANTITY = 0.01;
export const MAX_INGREDIENT_QUANTITY = 99999999.99;
export const MAX_SEARCH_LENGTH = 100;
export const MAX_ID_TOKEN_LENGTH = 4096;
export const MAX_INGREDIENT_NOTES_LENGTH = 255;

export const VALIDATION_MESSAGES = {
  usernameType: 'Username must be a text string',
  usernameEmpty: 'The username cannot be empty',
  usernameMin: 'Username must be at least 3 characters long',
  usernameMax: 'Username cannot exceed 30 characters',
  usernameFormat:
    'Username can only contain letters, numbers, underscores, and hyphens',
  emailFormat: 'Please enter a valid email address',
  emailEmpty: 'The email cannot be empty',
  emailMax: 'Email address cannot exceed 255 characters',
  passwordEmpty: 'The password cannot be empty',
  passwordType: 'Password must be a text string',
  passwordMin: 'The password must have at least 9 characters',
  passwordMax: 'Password cannot exceed 72 characters',
  passwordStrength:
    'Password is too weak (needs uppercase, lowercase, and a number or symbol)',
  phoneType: 'Phone number must be a text string',
  phoneMax: 'Phone number cannot exceed 30 characters',
  phoneFormat:
    'Phone number must contain 7 to 15 digits and may only include numbers, spaces, +, -, (, ), and . (e.g. +39 06 1234567)',
  postalCodeType: 'Postal code must be a text string',
  postalCodeMax: 'Postal code cannot exceed 10 characters',
  postalCodeFormat:
    'Postal code must be 3 to 10 characters, include at least one digit, and contain only letters, numbers, spaces, or hyphens (e.g. 00100, SW1A 1AA, 10001-1234)',
  birthDateFormat: 'Birth date must be a valid ISO 8601 date (e.g. YYYY-MM-DD)',
  firstNameType: 'First name must be a text string',
  firstNameMax: 'First name cannot exceed 100 characters',
  lastNameType: 'Last name must be a text string',
  lastNameMax: 'Last name cannot exceed 100 characters',
  addressType: 'Address must be a text string',
  addressMax: 'Address cannot exceed 255 characters',
  cityType: 'City must be a text string',
  cityMax: 'City cannot exceed 100 characters',
  bioType: 'Bio must be a text string',
  bioMax: 'Bio cannot exceed 500 characters',
  profilePrivacyEnum:
    'Profile privacy must be one of: public, friends_only, private',
  langUnsupported: 'lang must be one of the following values: it, en, fr',
  idRange: `ID must be an integer between 1 and ${INT32_MAX}`,
} as const;
