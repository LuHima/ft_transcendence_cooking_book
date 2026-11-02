import { ApiProperty } from '@nestjs/swagger';

/**
 * Item representing a blocked user account.
 */
export class BlockedUserItemDto {
  /**
   * Blocked user identifier.
   * @example 42
   */
  @ApiProperty({ description: 'Blocked user identifier', example: 42 })
  id: number;

  /**
   * Username handle of the blocked user.
   * @example 'toxic_user'
   */
  @ApiProperty({
    description: 'Username of the blocked user',
    example: 'toxic_user',
  })
  username: string;

  /**
   * Public avatar photo URL of the blocked user.
   * @example '/uploads/avatars/avatar_42.webp'
   */
  @ApiProperty({
    type: String,
    description: 'Public avatar photo URL of the blocked user',
    example: '/uploads/avatars/avatar_42.webp',
    nullable: true,
  })
  avatar_url: string | null;

  /**
   * Timestamp when the block was initiated.
   * @example '2026-11-01T10:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Timestamp when the user was blocked',
    example: '2026-11-01T10:00:00.000Z',
  })
  blocked_at: Date;
}

/**
 * Paginated collection of blocked user accounts.
 */
export class PaginatedBlockedUsersResponseDto {
  @ApiProperty({
    type: [BlockedUserItemDto],
    description: 'List of blocked users',
  })
  items: BlockedUserItemDto[];

  @ApiProperty({ description: 'Total number of blocked users', example: 1 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of available pages', example: 1 })
  total_pages: number;

  @ApiProperty({
    description: 'Flag indicating if next page exists',
    example: false,
  })
  has_next_page: boolean;

  @ApiProperty({
    description: 'Flag indicating if previous page exists',
    example: false,
  })
  has_prev_page: boolean;
}
