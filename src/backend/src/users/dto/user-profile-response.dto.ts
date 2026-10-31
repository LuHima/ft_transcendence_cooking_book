import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * Full private user profile returned for the authenticated user.
 */
export class UserProfileResponseDto {
  /**
   * Unique user identifier.
   * @example 1
   */
  @ApiProperty({ description: 'User identifier', example: 1 })
  id: number;

  /**
   * Unique username.
   * @example 'mario_rossi'
   */
  @ApiProperty({ description: 'Unique username', example: 'mario_rossi' })
  username: string;

  /**
   * Account email address.
   * @example 'mario.rossi@example.com'
   */
  @ApiProperty({
    description: 'Email address',
    example: 'mario.rossi@example.com',
  })
  email: string;

  /**
   * Assigned system role.
   * @example Role.user
   */
  @ApiProperty({ enum: Role, description: 'User role', example: Role.user })
  role: Role;

  /**
   * URL to user avatar photo.
   * @example '/uploads/avatars/avatar_1.webp'
   */
  @ApiProperty({
    type: String,
    description: 'Avatar image URL',
    example: '/uploads/avatars/avatar_1.webp',
    nullable: true,
  })
  avatar_url: string | null;

  /**
   * Culinary biography / cooking philosophy.
   * @example 'Passionate about authentic Neapolitan pizza and fresh handmade pasta.'
   */
  @ApiProperty({
    type: String,
    description: 'Culinary biography / cooking philosophy',
    example:
      'Passionate about authentic Neapolitan pizza and fresh handmade pasta.',
    nullable: true,
  })
  bio: string | null;

  /**
   * User first name.
   * @example 'Mario'
   */
  @ApiProperty({
    type: String,
    description: 'First name',
    example: 'Mario',
    nullable: true,
  })
  first_name: string | null;

  /**
   * User last name.
   * @example 'Rossi'
   */
  @ApiProperty({
    type: String,
    description: 'Last name',
    example: 'Rossi',
    nullable: true,
  })
  last_name: string | null;

  /**
   * User date of birth.
   * @example '1995-05-20T00:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Date of birth',
    example: '1995-05-20T00:00:00.000Z',
    nullable: true,
  })
  birth_date: Date | null;

  /**
   * Contact phone number.
   * @example '+39 06 1234567'
   */
  @ApiProperty({
    type: String,
    description: 'Phone number',
    example: '+39 06 1234567',
    nullable: true,
  })
  phone: string | null;

  /**
   * Residential street address.
   * @example 'Via Roma 123'
   */
  @ApiProperty({
    type: String,
    description: 'Residential street address',
    example: 'Via Roma 123',
    nullable: true,
  })
  address: string | null;

  /**
   * City of residence.
   * @example 'Roma'
   */
  @ApiProperty({
    type: String,
    description: 'City of residence',
    example: 'Roma',
    nullable: true,
  })
  city: string | null;

  /**
   * Postal code.
   * @example '00100'
   */
  @ApiProperty({
    type: String,
    description: 'Postal code / ZIP',
    example: '00100',
    nullable: true,
  })
  postal_code: string | null;

  /**
   * Account registration date.
   * @example '2026-10-09T18:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Account creation timestamp',
    example: '2026-10-09T18:00:00.000Z',
  })
  created_at: Date;
}

/**
 * Public profile information visible to other users.
 */
export class PublicUserResponseDto {
  /**
   * Unique user identifier.
   * @example 1
   */
  @ApiProperty({ description: 'User identifier', example: 1 })
  id: number;

  /**
   * Username of the member.
   * @example 'mario_rossi'
   */
  @ApiProperty({ description: 'Username', example: 'mario_rossi' })
  username: string;

  /**
   * First name of the member.
   * @example 'Mario'
   */
  @ApiProperty({
    type: String,
    description: 'First name',
    example: 'Mario',
    nullable: true,
  })
  first_name: string | null;

  /**
   * Last name of the member.
   * @example 'Rossi'
   */
  @ApiProperty({
    type: String,
    description: 'Last name',
    example: 'Rossi',
    nullable: true,
  })
  last_name: string | null;

  /**
   * Public avatar photo URL.
   * @example '/uploads/avatars/avatar_1.webp'
   */
  @ApiProperty({
    type: String,
    description: 'Public avatar photo URL',
    example: '/uploads/avatars/avatar_1.webp',
    nullable: true,
  })
  avatar_url: string | null;

  /**
   * Culinary biography / cooking philosophy.
   * @example 'Passionate about authentic Neapolitan pizza and fresh pasta.'
   */
  @ApiProperty({
    type: String,
    description: 'Culinary biography / cooking philosophy',
    example: 'Passionate about authentic Neapolitan pizza and fresh pasta.',
    nullable: true,
  })
  bio: string | null;

  /**
   * Member registration date.
   * @example '2026-10-09T18:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Member since date',
    example: '2026-10-09T18:00:00.000Z',
  })
  created_at: Date;

  /**
   * Total published recipes.
   * @example 12
   */
  @ApiProperty({
    description: 'Total published recipes',
    example: 12,
  })
  recipes_count: number;

  /**
   * Total confirmed friends.
   * @example 45
   */
  @ApiProperty({
    description: 'Total confirmed friends',
    example: 45,
  })
  friends_count: number;

  /**
   * Cumulative likes across all authored recipes.
   * @example 138
   */
  @ApiProperty({
    description: 'Cumulative likes across all authored recipes',
    example: 138,
  })
  total_likes_received: number;

  /**
   * Current user friendship relation with this profile.
   * @example 'friends'
   */
  @ApiPropertyOptional({
    description:
      'Current user friendship status with this profile (friends, pending_sent, pending_received, none, or null for self/guest)',
    enum: ['none', 'pending_sent', 'pending_received', 'friends'],
    nullable: true,
    example: 'friends',
  })
  friendship_status?:
    'none' | 'pending_sent' | 'pending_received' | 'friends' | null;
}

/**
 * Member card item returned in user discovery and search results.
 */
export class UserSearchItemDto {
  /**
   * Unique user identifier.
   * @example 1
   */
  @ApiProperty({ description: 'User identifier', example: 1 })
  id: number;

  /**
   * Unique username of the community member.
   * @example 'mario_rossi'
   */
  @ApiProperty({ description: 'Unique username', example: 'mario_rossi' })
  username: string;

  /**
   * Public avatar photo URL.
   * @example '/uploads/avatars/avatar_1.webp'
   */
  @ApiProperty({
    type: String,
    description: 'Avatar image URL',
    example: '/uploads/avatars/avatar_1.webp',
    nullable: true,
  })
  avatar_url: string | null;

  /**
   * First name of the member.
   * @example 'Mario'
   */
  @ApiProperty({
    type: String,
    description: 'First name',
    example: 'Mario',
    nullable: true,
  })
  first_name: string | null;

  /**
   * Last name of the member.
   * @example 'Rossi'
   */
  @ApiProperty({
    type: String,
    description: 'Last name',
    example: 'Rossi',
    nullable: true,
  })
  last_name: string | null;

  /**
   * Account registration date.
   * @example '2026-10-15T12:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Account registration timestamp',
    example: '2026-10-15T12:00:00.000Z',
  })
  created_at: Date;

  /**
   * Total published recipes authored by the member.
   * @example 12
   */
  @ApiProperty({
    description: 'Total published recipes',
    example: 12,
  })
  recipes_count: number;

  /**
   * Contextual friendship status relative to the authenticated caller.
   * Set to null for unauthenticated guests.
   * @example 'friends'
   */
  @ApiPropertyOptional({
    description:
      'Contextual friendship status relative to the authenticated caller (friends, pending_sent, pending_received, none, or null for guests)',
    enum: ['none', 'pending_sent', 'pending_received', 'friends'],
    nullable: true,
    example: 'friends',
  })
  friendship_status:
    'none' | 'pending_sent' | 'pending_received' | 'friends' | null;
}

/**
 * Paginated collection of user discovery and search results.
 */
export class PaginatedUsersResponseDto {
  @ApiProperty({
    type: [UserSearchItemDto],
    description: 'Collection of member cards for the current page window',
  })
  items: UserSearchItemDto[];

  @ApiProperty({
    description: 'Total count of active members matching query',
    example: 42,
  })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Number of items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total number of available pages', example: 3 })
  total_pages: number;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  has_next_page: boolean;

  @ApiProperty({
    description: 'Whether a previous page exists',
    example: false,
  })
  has_prev_page: boolean;
}

/**
 * User search result item (legacy username-only projection).
 */
export class UserSearchResultDto {
  /**
   * Matching username.
   * @example 'mario_rossi'
   */
  @ApiProperty({ description: 'Matching username', example: 'mario_rossi' })
  username: string;
}

/**
 * Avatar upload response.
 */
export class AvatarUploadResponseDto {
  /**
   * Static path to the uploaded avatar image.
   * @example '/uploads/avatars/avatar_1.webp'
   */
  @ApiProperty({
    description: 'Static URL path to newly saved avatar photo',
    example: '/uploads/avatars/avatar_1.webp',
  })
  avatar_url: string;
}

/**
 * User operation status message.
 */
export class UserMessageResponseDto {
  /**
   * Status message describing outcome.
   * @example 'Avatar deleted successfully'
   */
  @ApiProperty({
    description: 'Status message',
    example: 'Avatar deleted successfully',
  })
  message: string;
}
