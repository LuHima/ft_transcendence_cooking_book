import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { Role, UserStatus } from '@prisma/client';
import { UserSortBy, SortOrder } from '../../users/dto/search-user-query.dto';

/**
 * Query parameter DTO for administrative member directory and user auditing.
 * Supports filtering by role, status, text search, and multi-criteria sorting.
 */
export class AdminSearchUserQueryDto extends PaginationQueryDto {
  /**
   * Search substring matching against username, first name, or last name.
   * Requires at least 2 non-whitespace characters.
   * @example 'mario'
   */
  @ApiPropertyOptional({
    description:
      'Search query substring matching username, first_name, or last_name (minimum 2 non-whitespace characters)',
    example: 'mario',
    minLength: 2,
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'search query must be at least 2 characters' })
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
  @IsEnum(Role)
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
  @IsEnum(UserStatus)
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
  @IsEnum(UserSortBy)
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
  @IsEnum(SortOrder)
  sort_order?: SortOrder;
}
