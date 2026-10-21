import { ApiPropertyOptional } from '@nestjs/swagger';
import { Course, RecipeDifficulty } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

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
   * Filter recipes associated with any of the specified tag IDs.
   * Supports comma-separated query string (e.g., \`?tag_ids=1,2,3\`) or
   * arrays (e.g., \`?tag_ids=1&tag_ids=2&tag_ids=3\`).
   * @example [1, 2]
   */
  @ApiPropertyOptional({
    description:
      'Filter recipes by tag IDs. Supports comma-separated string e.g. "tag_ids=1,2" or single numbers e.g. "tag_ids=1&tag_ids=2"',
    example: [1, 2],
    type: [Number],
  })
  @IsOptional()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map(Number);
    if (typeof value === 'string') {
      return value.split(',').map((s) => Number(s.trim()));
    }
    if (typeof value === 'number') return [value];
    return undefined;
  })
  tag_ids?: number[];

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
}
