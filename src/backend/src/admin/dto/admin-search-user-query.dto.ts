import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role, UserStatus } from '@prisma/client';
import { UserSortBy, SortOrder } from '../../users/dto/search-user-query.dto';
import { trimToUndefined } from '../../common/dto/string-transforms';
import { MAX_SEARCH_LENGTH } from '../../common/validators/validation-constants';

/**
 * Query parameter DTO for administrative member directory and user auditing.
 * Supports filtering by role, status, text search, and multi-criteria sorting.
 */
export class AdminSearchUserQueryDto extends PaginationQueryDto {
  /**
   * Search substring matching against username, first name, or last name.
   * Requires at least 2 non-whitespace characters.
   * Whitespace-only strings are normalized to undefined.
   * @example 'mario'
   */
  @ApiPropertyOptional({
    description:
      'Search query substring matching username, first_name, or last_name (2-100 non-whitespace characters)',
    example: 'mario',
    minLength: 2,
    maxLength: MAX_SEARCH_LENGTH,
  })
  @Transform(trimToUndefined)
  @IsOptional()
  @IsString({ message: 'search query must be a text string' })
  @MinLength(2, { message: 'search query must be at least 2 characters' })
  @MaxLength(MAX_SEARCH_LENGTH, {
    message: `search query cannot exceed ${MAX_SEARCH_LENGTH} characters`,
  })
  search?: string;

  /**
   * Filter users by system role.
   * @example Role.admin
   */
  @ApiPropertyOptional({
    enum: Role,
    description: 'Filter accounts by system role (admin, moderator, user)',
    example: Role.user,
  })
  @IsOptional()
  @IsEnum(Role, { message: 'role must be one of: admin, moderator, user' })
  role?: Role;

  /**
   * Filter users by account lifecycle status.
   * @example UserStatus.active
   */
  @ApiPropertyOptional({
    enum: UserStatus,
    description:
      'Filter accounts by lifecycle status (active, disabled, banned)',
    example: UserStatus.active,
  })
  @IsOptional()
  @IsEnum(UserStatus, {
    message: 'status must be one of: active, disabled, banned',
  })
  status?: UserStatus;

  /**
   * Field to sort users by.
   * Contextual default: username if search is specified, created_at if omitted.
   * @example UserSortBy.created_at
   */
  @ApiPropertyOptional({
    enum: UserSortBy,
    description:
      'Field to sort users by. Contextual default: username if search is specified, created_at if omitted.',
    example: UserSortBy.created_at,
  })
  @IsOptional()
  @IsEnum(UserSortBy, { message: 'Invalid sort_by value' })
  sort_by?: UserSortBy;

  /**
   * Sort direction. Defaults to desc for created_at and recipes_count, asc for username.
   * @example SortOrder.desc
   */
  @ApiPropertyOptional({
    enum: SortOrder,
    description:
      'Sort direction. Defaults to desc for created_at and recipes_count, asc for username.',
    example: SortOrder.desc,
  })
  @IsOptional()
  @IsEnum(SortOrder, { message: 'sort_order must be asc or desc' })
  sort_order?: SortOrder;
}
