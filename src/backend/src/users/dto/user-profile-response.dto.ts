import { ApiProperty } from '@nestjs/swagger';
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
    description: 'Avatar image URL',
    example: '/uploads/avatars/avatar_1.webp',
    nullable: true,
  })
  avatar_url: string | null;

  /**
   * User first name.
   * @example 'Mario'
   */
  @ApiProperty({ description: 'First name', example: 'Mario', nullable: true })
  first_name: string | null;

  /**
   * User last name.
   * @example 'Rossi'
   */
  @ApiProperty({ description: 'Last name', example: 'Rossi', nullable: true })
  last_name: string | null;

  /**
   * User date of birth.
   * @example '1995-05-20T00:00:00.000Z'
   */
  @ApiProperty({
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
   * Public avatar photo URL.
   * @example '/uploads/avatars/avatar_1.webp'
   */
  @ApiProperty({
    description: 'Public avatar photo URL',
    example: '/uploads/avatars/avatar_1.webp',
    nullable: true,
  })
  avatar_url: string | null;

  /**
   * Member registration date.
   * @example '2026-10-09T18:00:00.000Z'
   */
  @ApiProperty({
    description: 'Member since date',
    example: '2026-10-09T18:00:00.000Z',
  })
  created_at: Date;
}

/**
 * User search result item.
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
