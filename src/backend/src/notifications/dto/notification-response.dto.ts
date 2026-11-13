import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationAction, NotificationSubject } from '@prisma/client';

/**
 * Standard confirmation message response for notification actions.
 */
export class NotificationMessageResponseDto {
  @ApiProperty({
    description: 'Status message confirming operation',
    example: 'All notifications marked as read',
  })
  message: string;
}

/**
 * Actor profile card representing the user who triggered the notification.
 */
export class NotificationActorDto {
  @ApiProperty({
    description: 'Numeric user ID of the actor',
    example: 5,
  })
  id: number;

  @ApiProperty({
    description: 'Username of the actor',
    example: 'mario_rossi',
  })
  username: string;

  @ApiProperty({
    description: 'Avatar image URL of the actor',
    example: '/uploads/avatars/avatar_5.webp',
    nullable: true,
    type: String,
  })
  avatar_url: string | null;
}

/**
 * Target resource summary associated with the notification.
 */
export class NotificationTargetDto {
  @ApiProperty({
    description: 'Numeric resource ID of the target resource',
    example: 42,
    nullable: true,
    type: Number,
  })
  id: number | null;

  @ApiProperty({
    description: 'Domain entity subject associated with the target',
    enum: NotificationSubject,
    example: NotificationSubject.recipe,
  })
  subject: NotificationSubject;

  @ApiPropertyOptional({
    description: 'Localized title of recipe or text snippet of comment',
    example: 'Lasagna alla Bolognese',
    nullable: true,
    type: String,
  })
  title_or_snippet?: string | null;

  @ApiPropertyOptional({
    description:
      'Parent recipe ID for comment interactions, or recipe ID for recipe interactions',
    example: 42,
    nullable: true,
    type: Number,
  })
  recipe_id?: number | null;
}

/**
 * Hydrated notification item payload with actor profile and target summaries.
 */
export class NotificationItemDto {
  @ApiProperty({
    description: 'Unique numeric notification ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'User ID of the recipient',
    example: 2,
  })
  user_id: number;

  @ApiProperty({
    description: 'Actor profile card who triggered the notification',
    type: () => NotificationActorDto,
  })
  actor: NotificationActorDto;

  @ApiProperty({
    description: 'Domain entity subject associated with the notification',
    enum: NotificationSubject,
    example: NotificationSubject.recipe,
  })
  subject: NotificationSubject;

  @ApiProperty({
    description: 'Action that triggered the notification',
    enum: NotificationAction,
    example: NotificationAction.like,
  })
  action: NotificationAction;

  @ApiProperty({
    description: 'Target resource metadata associated with the notification',
    type: () => NotificationTargetDto,
  })
  target: NotificationTargetDto;

  @ApiProperty({
    description: 'Human-readable localized notification message',
    example:
      "Mario ha messo 'Mi piace' alla tua ricetta 'Lasagna alla Bolognese'",
  })
  message: string;
  @ApiPropertyOptional({
    description:
      'Explanation written by the moderator (only for warning notifications)',
    example: 'Your recipe contained offensive language.',
    nullable: true,
    type: String,
  })
  details?: string | null;

  @ApiProperty({
    description: 'Whether the notification has been marked as read',
    example: false,
  })
  is_read: boolean;

  @ApiProperty({
    description: 'Timestamp when the notification was created',
    example: '2026-10-28T12:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at: Date;
}

/**
 * Bounded paginated collection wrapper for user notifications including inbox unread count.
 */
export class PaginatedNotificationResponseDto {
  @ApiProperty({
    type: () => [NotificationItemDto],
    description: 'List of notifications for the authenticated user',
  })
  items: NotificationItemDto[];

  @ApiProperty({
    description: 'Total number of notifications matching filter',
    example: 10,
  })
  total: number;

  @ApiProperty({
    description: 'Current page window index',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page window',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of available pages',
    example: 1,
  })
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

  @ApiProperty({
    description: 'Total number of unread notifications in inbox',
    example: 4,
  })
  unread_count: number;
}

/**
 * Compatibility alias for PaginatedNotificationResponseDto.
 */
export { PaginatedNotificationResponseDto as NotificationListResponseDto };
