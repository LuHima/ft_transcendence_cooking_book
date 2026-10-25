import { ApiProperty } from '@nestjs/swagger';

/**
 * Confirmed friend profile overview item.
 */
export class FriendItemDto {
  /**
   * User identifier of the friend.
   * @example 2
   */
  @ApiProperty({ description: 'User identifier', example: 2 })
  id: number;

  /**
   * Unique username of the friend.
   * @example 'giuly_cooks'
   */
  @ApiProperty({ description: 'Friend username', example: 'giuly_cooks' })
  username: string;

  /**
   * Public avatar photo URL.
   * @example '/uploads/avatars/avatar_2.webp'
   */
  @ApiProperty({
    description: 'Public avatar photo URL',
    example: '/uploads/avatars/avatar_2.webp',
    nullable: true,
  })
  avatar_url: string | null;

  /**
   * Timestamp when the friendship was accepted.
   * @example '2026-10-15T12:00:00.000Z'
   */
  @ApiProperty({
    description: 'Timestamp when friendship was established',
    example: '2026-10-15T12:00:00.000Z',
  })
  friends_since: Date;
}

/**
 * Paginated collection of confirmed friends.
 */
export class PaginatedFriendsResponseDto {
  @ApiProperty({ type: [FriendItemDto], description: 'List of friends' })
  items: FriendItemDto[];

  @ApiProperty({ description: 'Total number of confirmed friends', example: 12 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of available pages', example: 1 })
  total_pages: number;

  @ApiProperty({ description: 'Flag indicating if next page exists', example: false })
  has_next_page: boolean;

  @ApiProperty({ description: 'Flag indicating if previous page exists', example: false })
  has_prev_page: boolean;
}

/**
 * Simple success message response for friend actions.
 */
export class FriendMessageResponseDto {
  @ApiProperty({
    description: 'Action outcome confirmation message',
    example: 'Friend removed successfully',
  })
  message: string;
}
