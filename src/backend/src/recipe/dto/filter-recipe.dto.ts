import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Course, RecipeDifficulty } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ArrayMaxSize,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { transformOptionalBoolean } from '../../common/dto/query-transforms';
import { trimToUndefined } from '../../common/dto/string-transforms';
import {
  INT32_MAX,
  MAX_FILTER_IDS,
  MAX_RECIPE_TIME_MINUTES,
  MAX_SEARCH_LENGTH,
  MAX_TOTAL_TIME_MINUTES,
  SUPPORTED_LOCALES,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

export enum RecipeSortBy {
  created_at = 'created_at',
  total_time = 'total_time',
  difficulty = 'difficulty',
  likes_count = 'likes_count',
  title = 'title',
}

export enum RecipeSortOrder {
  asc = 'asc',
  desc = 'desc',
}

export type FilterMatchMode = 'all' | 'any';

@ValidatorConstraint({ name: 'isNotIntersecting', async: false })
export class IsNotIntersectingConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints as [string];
    const obj = args.object as Record<string, unknown> | undefined;
    const relatedValue = obj?.[relatedPropertyName];
    if (!Array.isArray(value) || !Array.isArray(relatedValue)) {
      return true;
    }
    const set = new Set<unknown>(value);
    return !relatedValue.some((item) => set.has(item));
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints as [string];
    return `${args.property} and ${relatedPropertyName} cannot contain common IDs`;
  }
}

export function IsNotIntersecting(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotIntersecting',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: IsNotIntersectingConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isCuratedOnlyWithLang', async: false })
export class IsCuratedOnlyWithLangConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { lang?: unknown } | undefined;
    if (value === true) {
      return typeof obj?.lang === 'string' && obj.lang.trim().length > 0;
    }
    return true;
  }

  defaultMessage(): string {
    return 'Target language (lang) must be specified when curated_only is true';
  }
}

export function IsCuratedOnlyWithLang(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCuratedOnlyWithLang',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: IsCuratedOnlyWithLangConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'isTimeRangeValid', async: false })
export class IsTimeRangeValidConstraint implements ValidatorConstraintInterface {
  validate(minTime: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { max_time?: unknown } | undefined;
    if (!Number.isFinite(minTime) || !Number.isFinite(obj?.max_time)) {
      return true;
    }
    return (minTime as number) <= (obj?.max_time as number);
  }

  defaultMessage(): string {
    return 'min_time cannot be greater than max_time';
  }
}

export function IsTimeRangeValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isTimeRangeValid',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: IsTimeRangeValidConstraint,
    });
  };
}

export function transformIdArray({ value }: { value: unknown }): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    return value.map((v) =>
      typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : Number(v),
    );
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => Number(s.trim()));
  }
  if (typeof value === 'number') {
    return [value];
  }
  return value;
}

function IsFilterIdArray(fieldName: string, disjointFieldName: string) {
  return applyDecorators(
    IsOptional(),
    Transform(transformIdArray),
    ArrayMaxSize(MAX_FILTER_IDS, {
      message: `${fieldName} cannot contain more than ${MAX_FILTER_IDS} items`,
    }),
    IsInt({ each: true, message: VALIDATION_MESSAGES.idRange }),
    Min(1, { each: true, message: VALIDATION_MESSAGES.idRange }),
    Max(INT32_MAX, { each: true, message: VALIDATION_MESSAGES.idRange }),
    IsNotIntersecting(disjointFieldName),
  );
}

/**
 * Query parameter data transfer object for multi-criteria recipe catalog
 * filtering, search, and pagination.
 */
export class FilterRecipeDto extends PaginationQueryDto {
  /**
   * Filter recipes by course category.
   * @example Course.main_course
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes by course meal category (first course, main course, dessert, etc.)',
    enum: Course,
    example: Course.main_course,
  })
  @IsOptional()
  @IsEnum(Course, { message: 'Invalid course category' })
  course?: Course;

  /**
   * Filter recipes by difficulty level.
   * @example RecipeDifficulty.easy
   */
  @ApiPropertyOptional({
    description: 'Filter recipes by difficulty level',
    enum: RecipeDifficulty,
    example: RecipeDifficulty.easy,
  })
  @IsOptional()
  @IsEnum(RecipeDifficulty, { message: 'Invalid difficulty level' })
  difficulty?: RecipeDifficulty;

  /**
   * Filter recipes associated with any or all of the specified tag IDs.
   * Supports comma-separated query string (e.g., `?tag_ids=1,2,3`) or
   * arrays (e.g., `?tag_ids=1&tag_ids=2&tag_ids=3`).
   * @example [1, 2]
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes by tag IDs. Supports comma-separated string e.g. "tag_ids=1,2" or repeated query params e.g. "tag_ids=1&tag_ids=2"',
    example: [1, 2],
    type: [Number],
  })
  @IsFilterIdArray('tag_ids', 'exclude_tag_ids')
  tag_ids?: number[];

  /**
   * Tag conjunction mode: 'all' requires all tag_ids to be present on the recipe,
   * while 'any' requires at least one tag_id. Defaults to 'all'.
   * @example 'all'
   */
  @ApiPropertyOptional({
    description:
      'Tag matching mode: "all" requires all specified tag_ids, "any" matches at least one tag_id (defaults to "all")',
    enum: ['all', 'any'],
    default: 'all',
    example: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'any'], { message: 'tag_mode must be either "all" or "any"' })
  tag_mode?: FilterMatchMode = 'all';

  /**
   * Exclude recipes associated with any of the specified tag IDs.
   * Supports comma-separated query string (e.g., `?exclude_tag_ids=3,4`) or arrays.
   * @example [3, 4]
   */
  @ApiPropertyOptional({
    description:
      'Exclude recipes containing any of the specified tag IDs. Supports comma-separated string e.g. "exclude_tag_ids=3,4"',
    example: [3, 4],
    type: [Number],
  })
  @IsFilterIdArray('exclude_tag_ids', 'tag_ids')
  exclude_tag_ids?: number[];

  /**
   * Filter recipes containing specific ingredient IDs (pantry search).
   * Supports comma-separated query string or arrays.
   * @example [10, 20]
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes by ingredient IDs (pantry search). Supports comma-separated string e.g. "ingredient_ids=10,20"',
    example: [10, 20],
    type: [Number],
  })
  @IsFilterIdArray('ingredient_ids', 'exclude_ingredient_ids')
  ingredient_ids?: number[];

  /**
   * Ingredient conjunction mode: 'all' requires all ingredient_ids to be present on the recipe,
   * while 'any' requires at least one ingredient_id. Defaults to 'all'.
   * @example 'all'
   */
  @ApiPropertyOptional({
    description:
      'Ingredient matching mode: "all" requires all specified ingredient_ids, "any" matches at least one ingredient_id (defaults to "all")',
    enum: ['all', 'any'],
    default: 'all',
    example: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'any'], {
    message: 'ingredient_mode must be either "all" or "any"',
  })
  ingredient_mode?: FilterMatchMode = 'all';

  /**
   * Exclude recipes containing any of the specified ingredient IDs (allergy / preference exclusion).
   * Supports comma-separated query string or arrays.
   * @example [30, 40]
   */
  @ApiPropertyOptional({
    description:
      'Exclude recipes containing any of the specified ingredient IDs. Supports comma-separated string e.g. "exclude_ingredient_ids=30,40"',
    example: [30, 40],
    type: [Number],
  })
  @IsFilterIdArray('exclude_ingredient_ids', 'ingredient_ids')
  exclude_ingredient_ids?: number[];

  /**
   * Filter recipes where total_time is greater than or equal to this limit (in minutes).
   * @example 15
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes where total_time is greater than or equal to this limit (in minutes)',
    minimum: 0,
    maximum: MAX_TOTAL_TIME_MINUTES,
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'min_time must be a whole number of minutes' })
  @Min(0, { message: 'min_time cannot be negative' })
  @Max(MAX_TOTAL_TIME_MINUTES, {
    message: `min_time cannot exceed ${MAX_TOTAL_TIME_MINUTES} minutes`,
  })
  @IsTimeRangeValid()
  min_time?: number;

  /**
   * Filter recipes where total_time is less than or equal to this limit (in minutes).
   * @example 30
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes where total_time is less than or equal to this limit (in minutes)',
    minimum: 0,
    maximum: MAX_TOTAL_TIME_MINUTES,
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'max_time must be a whole number of minutes' })
  @Min(0, { message: 'max_time cannot be negative' })
  @Max(MAX_TOTAL_TIME_MINUTES, {
    message: `max_time cannot exceed ${MAX_TOTAL_TIME_MINUTES} minutes`,
  })
  max_time?: number;

  /**
   * Filter recipes where prep_time is less than or equal to this limit (in minutes).
   * @example 15
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes where prep_time is less than or equal to this limit (in minutes)',
    minimum: 0,
    maximum: MAX_RECIPE_TIME_MINUTES,
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'max_prep_time must be a whole number of minutes' })
  @Min(0, { message: 'max_prep_time cannot be negative' })
  @Max(MAX_RECIPE_TIME_MINUTES, {
    message: `max_prep_time cannot exceed ${MAX_RECIPE_TIME_MINUTES} minutes`,
  })
  max_prep_time?: number;

  /**
   * Filter recipes authored by a specific user ID.
   * @example 1
   */
  @ApiPropertyOptional({
    description: 'Filter recipes authored by a specific user ID',
    minimum: 1,
    maximum: INT32_MAX,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: VALIDATION_MESSAGES.idRange })
  @Min(1, { message: VALIDATION_MESSAGES.idRange })
  @Max(INT32_MAX, { message: VALIDATION_MESSAGES.idRange })
  author_id?: number;

  /**
   * Keyword search query matching recipe title or description.
   * @example 'pasta'
   */
  @ApiPropertyOptional({
    description:
      'Keyword search query matching recipe title or description (max 100 characters)',
    maxLength: MAX_SEARCH_LENGTH,
    example: 'pasta',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'search query must be a text string' })
  @MaxLength(MAX_SEARCH_LENGTH, {
    message: `search query cannot exceed ${MAX_SEARCH_LENGTH} characters`,
  })
  search?: string;

  /**
   * Filter recipes by the authoring original source language code ('it', 'en', 'fr').
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes by the authoring original source language code (it, en, fr)',
    enum: SUPPORTED_LOCALES,
    example: 'it',
  })
  @IsOptional()
  @IsString({ message: 'source_lang must be a text string' })
  @IsIn(SUPPORTED_LOCALES, {
    message: 'source_lang must be one of the following values: it, en, fr',
  })
  source_lang?: string;

  /**
   * When true, only return recipes that have human-curated (author_original or manual) translations
   * in the specified `lang` locale. Requires `lang` to be specified.
   * @example true
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes that have human-verified translations (author_original or manual) for the requested locale. Requires lang parameter to be specified.',
    example: true,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean({ message: 'curated_only must be a boolean (true or false)' })
  @IsCuratedOnlyWithLang()
  curated_only?: boolean;

  /**
   * Target locale code for projected title and description.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description: 'Target locale code for projected title and description',
    enum: SUPPORTED_LOCALES,
    example: 'it',
  })
  @IsOptional()
  @IsString({ message: 'lang must be a text string' })
  @IsIn(SUPPORTED_LOCALES, { message: VALIDATION_MESSAGES.langUnsupported })
  lang?: 'it' | 'en' | 'fr';

  /**
   * Field to sort recipes by. Defaults to 'created_at'.
   * @example RecipeSortBy.created_at
   */
  @ApiPropertyOptional({
    description: 'Field to sort recipes by (defaults to "created_at")',
    enum: RecipeSortBy,
    default: RecipeSortBy.created_at,
    example: RecipeSortBy.created_at,
  })
  @IsOptional()
  @IsEnum(RecipeSortBy, { message: 'Invalid sort_by value' })
  sort_by?: RecipeSortBy = RecipeSortBy.created_at;

  /**
   * Sort direction. Defaults contextually to 'desc' for created_at and likes_count,
   * and 'asc' for total_time, difficulty, and title.
   * @example RecipeSortOrder.desc
   */
  @ApiPropertyOptional({
    description:
      'Sort direction. Defaults to "desc" for created_at and likes_count, "asc" for total_time, difficulty, and title',
    enum: RecipeSortOrder,
    example: RecipeSortOrder.desc,
  })
  @IsOptional()
  @IsEnum(RecipeSortOrder, { message: 'sort_order must be asc or desc' })
  sort_order?: RecipeSortOrder;
}
