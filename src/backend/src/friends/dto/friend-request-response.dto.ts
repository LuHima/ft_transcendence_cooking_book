import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Pending friend request item details.
 */
export class FriendRequestItemDto {
  /**
   * User ID of the counterparty (sender for incoming, recipient for outgoing).
   * @example 4
   */
  @ApiProperty({ description: 'User ID of counterparty', example: 4 })
  id: number;

  /**
   * Username of the counterparty.
   * @example 'chef_marco'
   */
  @ApiProperty({ description: 'Username of counterparty', example: 'chef_marco' })
  username: string;

  /**
   * Avatar URL of the counterparty.
   * @example '/uploads/avatars/avatar_4.webp'
   */
  @ApiProperty({
    type: String,
    description: 'Avatar URL of counterparty',
    example: '/uploads/avatars/avatar_4.webp',
    nullable: true,
  })
  avatar_url: string | null;

  /**
   * Timestamp when the friend request was initiated.
   * @example '2026-10-20T15:30:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Timestamp when request was sent',
    example: '2026-10-20T15:30:00.000Z',
  })
  created_at: Date;
}

/**
 * Paginated collection of pending friend requests.
 */
export class PaginatedFriendRequestsResponseDto {
  @ApiProperty({
    type: [FriendRequestItemDto],
    description: 'List of pending friend requests',
  })
  items: FriendRequestItemDto[];

  @ApiProperty({ description: 'Total number of pending requests', example: 3 })
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
 * Response returned after a friend request lifecycle action (send, accept, reject, cancel).
 */
export class FriendRequestActionResponseDto {
  @ApiProperty({
    description: 'Result message describing outcome',
    example: 'Friend request sent',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Resulting relationship status when sending request',
    enum: ['pending', 'accepted'],
    example: 'pending',
  })
  status?: 'pending' | 'accepted';
}
