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
  Length,
  Min,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

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
export class IsNotIntersectingConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments): boolean {
    const [relatedPropertyName] = args.constraints;
    const relatedValue = (args.object as any)?.[relatedPropertyName];
    if (!Array.isArray(value) || !Array.isArray(relatedValue)) {
      return true;
    }
    const set = new Set(value);
    return !relatedValue.some((item) => set.has(item));
  }

  defaultMessage(args: ValidationArguments): string {
    const [relatedPropertyName] = args.constraints;
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
export class IsCuratedOnlyWithLangConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments): boolean {
    const obj = args.object as any;
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

export function transformIdArray({
  value,
}: {
  value: any;
}): number[] | undefined {
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
  @IsEnum(Course)
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
  @IsEnum(RecipeDifficulty)
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
  @IsOptional()
  @Transform(transformIdArray)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsNotIntersecting('exclude_tag_ids')
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
  @IsIn(['all', 'any'])
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
  @IsOptional()
  @Transform(transformIdArray)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsNotIntersecting('tag_ids')
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
  @IsOptional()
  @Transform(transformIdArray)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsNotIntersecting('exclude_ingredient_ids')
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
  @IsIn(['all', 'any'])
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
  @IsOptional()
  @Transform(transformIdArray)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @IsNotIntersecting('ingredient_ids')
  exclude_ingredient_ids?: number[];

  /**
   * Filter recipes where total_time is greater than or equal to this limit (in minutes).
   * @example 15
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes where total_time is greater than or equal to this limit (in minutes)',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_time?: number;

  /**
   * Filter recipes where total_time is less than or equal to this limit (in minutes).
   * @example 30
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes where total_time is less than or equal to this limit (in minutes)',
    example: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_time?: number;

  /**
   * Filter recipes where prep_time is less than or equal to this limit (in minutes).
   * @example 15
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes where prep_time is less than or equal to this limit (in minutes)',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_prep_time?: number;

  /**
   * Filter recipes authored by a specific user ID.
   * @example 1
   */
  @ApiPropertyOptional({
    description: 'Filter recipes authored by a specific user ID',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  author_id?: number;

  /**
   * Keyword search query matching recipe title or description.
   * @example 'pasta'
   */
  @ApiPropertyOptional({
    description: 'Keyword search query matching recipe title or description',
    example: 'pasta',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Filter recipes by the authoring original source language code (e.g., 'it', 'en', 'fr').
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes by the authoring original source language code (e.g., "it", "en", "fr")',
    example: 'it',
  })
  @IsOptional()
  @IsString()
  @Length(2, 5)
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
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  @IsCuratedOnlyWithLang()
  curated_only?: boolean;

  /**
   * Target locale code for projected title and description.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description: 'Target locale code for projected title and description',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @IsOptional()
  @IsIn(['it', 'en', 'fr'])
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
  @IsEnum(RecipeSortBy)
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
  @IsEnum(RecipeSortOrder)
  sort_order?: RecipeSortOrder;
}
