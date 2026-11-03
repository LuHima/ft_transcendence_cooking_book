import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Role, UserStatus } from '@prisma/client';
import { IsTrustedAvatarUrl } from '../validators/trusted-avatar-url.validator';

/**
 * Data transfer object for administrative user provisioning.
 */
export class CreateAdminUserDto {
  /**
   * Unique account username (3-30 characters).
   * @example 'moderator_chef'
   */
  @ApiProperty({
    description: 'Unique username (3-30 characters)',
    example: 'moderator_chef',
    minLength: 3,
    maxLength: 30,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  /**
   * Unique user email address.
   * @example 'moderator@wecook.com'
   */
  @ApiProperty({
    description: 'User email address',
    example: 'moderator@wecook.com',
  })
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : undefined,
  )
  @IsEmail()
  email: string;

  /**
   * Account initial password (minimum 8 characters).
   * @example 'SecurePassword123!'
   */
  @ApiProperty({
    description: 'Initial plaintext password (minimum 8 characters)',
    example: 'SecurePassword123!',
    minLength: 8,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  /**
   * Assigned administrative or community role.
   * @example Role.moderator
   */
  @ApiProperty({
    enum: Role,
    description: 'Assigned platform role',
    example: Role.moderator,
  })
  @IsNotEmpty()
  @IsEnum(Role)
  role: Role;

  /**
   * Initial account lifecycle status. Defaults to active.
   * @example UserStatus.active
   */
  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Initial account lifecycle status (defaults to active)',
    example: UserStatus.active,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  /**
   * Optional initial avatar URL (must be a local upload or trusted HTTPS domain).
   * @example '/uploads/avatars/default.webp'
   */
  @ApiPropertyOptional({
    description:
      'Avatar image URL (local path /uploads/avatars/* or trusted HTTPS domain)',
    example: '/uploads/avatars/default.webp',
  })
  @IsOptional()
  @IsString()
  @IsTrustedAvatarUrl()
  avatar_url?: string;

  /**
   * Culinary biography / staff notes (maximum 500 characters).
   * @example 'Staff moderator specializing in Mediterranean culinary techniques.'
   */
  @ApiPropertyOptional({
    description: 'Culinary biography / description (maximum 500 characters)',
    example:
      'Staff moderator specializing in Mediterranean culinary techniques.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  /**
   * Member first name.
   * @example 'Luca'
   */
  @ApiPropertyOptional({
    description: 'First name',
    example: 'Luca',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  /**
   * Member last name.
   * @example 'Bianchi'
   */
  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Bianchi',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string;

  /**
   * Date of birth (ISO 8601 string or Date).
   * @example '1990-05-15'
   */
  @ApiPropertyOptional({
    description: 'Date of birth (ISO 8601 date string)',
    example: '1990-05-15',
  })
  @IsOptional()
  birth_date?: string | Date;

  /**
   * Contact phone number.
   * @example '+39 02 1234567'
   */
  @ApiPropertyOptional({
    description: 'Contact phone number',
    example: '+39 02 1234567',
    maxLength: 30,
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  /**
   * Street address.
   * @example 'Corso Buenos Aires 45'
   */
  @ApiPropertyOptional({
    description: 'Residential address',
    example: 'Corso Buenos Aires 45',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  /**
   * City of residence.
   * @example 'Milano'
   */
  @ApiPropertyOptional({
    description: 'City of residence',
    example: 'Milano',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /**
   * Postal code.
   * @example '20124'
   */
  @ApiPropertyOptional({
    description: 'Postal code / ZIP',
    example: '20124',
    maxLength: 10,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postal_code?: string;
}
