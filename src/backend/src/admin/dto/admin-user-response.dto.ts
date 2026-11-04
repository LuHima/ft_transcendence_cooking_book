import { ApiProperty } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

/**
 * Detailed user representation returned to platform administrators.
 */
export class AdminUserResponseDto {
  /**
   * Unique numeric user identifier.
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
   * User email address.
   * @example 'mario.rossi@example.com'
   */
  @ApiProperty({
    description: 'Email address',
    example: 'mario.rossi@example.com',
  })
  email: string;

  /**
   * System role.
   * @example Role.admin
   */
  @ApiProperty({ enum: Role, description: 'User role', example: Role.admin })
  role: Role;

  /**
   * Account lifecycle status.
   * @example UserStatus.active
   */
  @ApiProperty({
    enum: UserStatus,
    description: 'Lifecycle status',
    example: UserStatus.active,
  })
  status: UserStatus;

  /**
   * Avatar URL.
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
   * Culinary biography / profile bio.
   * @example 'Italian chef passionate about sourdough and pasta.'
   */
  @ApiProperty({
    type: String,
    description: 'Biography / user description',
    example: 'Italian chef passionate about sourdough and pasta.',
    nullable: true,
  })
  bio: string | null;

  /**
   * First name.
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
   * Last name.
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
   * Date of birth.
   * @example '1990-01-01T00:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Date of birth',
    example: '1990-01-01T00:00:00.000Z',
    nullable: true,
  })
  birth_date: Date | null;

  /**
   * Phone number.
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
   * Street address.
   * @example 'Via Roma 1'
   */
  @ApiProperty({
    type: String,
    description: 'Street address',
    example: 'Via Roma 1',
    nullable: true,
  })
  address: string | null;

  /**
   * City of residence.
   * @example 'Roma'
   */
  @ApiProperty({
    type: String,
    description: 'City',
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
   * Total published recipes.
   * @example 5
   */
  @ApiProperty({
    description: 'Total published recipes authored by the user',
    example: 5,
  })
  recipes_count: number;

  /**
   * Account registration timestamp.
   * @example '2026-10-01T12:00:00.000Z'
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Account registration timestamp',
    example: '2026-10-01T12:00:00.000Z',
  })
  created_at: Date;

  /**
   * Active ban expiration timestamp (null if permanent or not banned).
   * @example null
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'Active ban expiration timestamp (null if permanent or not banned)',
    example: null,
    nullable: true,
  })
  banned_until?: Date | null;

  /**
   * Total number of prior sanctions/bans recorded for this user.
   * @example 0
   */
  @ApiProperty({
    description: 'Total number of prior sanctions/bans recorded for this user',
    example: 0,
  })
  previous_bans_count?: number;

  /**
   * Deletion timestamp if soft deleted.
   * @example null
   */
  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Account soft-deletion timestamp',
    example: null,
    nullable: true,
  })
  deleted_at: Date | null;
}

/**
 * Paginated collection envelope for administrative user directory.
 */
export class PaginatedAdminUsersResponseDto {
  @ApiProperty({
    type: [AdminUserResponseDto],
    description: 'User items matching the administrative search query',
  })
  items: AdminUserResponseDto[];

  @ApiProperty({
    description: 'Total number of users matching query',
    example: 42,
  })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total available pages', example: 3 })
  total_pages: number;

  @ApiProperty({
    description: 'Indicates whether a next page exists',
    example: true,
  })
  has_next_page: boolean;

  @ApiProperty({
    description: 'Indicates whether a previous page exists',
    example: false,
  })
  has_prev_page: boolean;
}
