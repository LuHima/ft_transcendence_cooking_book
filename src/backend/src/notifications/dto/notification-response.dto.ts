import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationAction, NotificationSubject } from '@prisma/client';

/**
 * Standard confirmation message response for notification actions.
 */
export class NotificationMessageResponseDto {
  @ApiProperty({
    description: 'Status message confirming operation',
    example: 'Read',
  })
  message: string;
}

/**
 * Notification item entity payload.
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
    description: 'User ID of the actor who triggered the notification',
    example: 5,
  })
  actor_id: number;

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

  @ApiPropertyOptional({
    description:
      'Optional ID of the target resource (e.g. recipe ID or comment ID)',
    nullable: true,
    example: 42,
  })
  target_id: number | null;

  @ApiProperty({
    description: 'Whether the notification has been marked as read',
    example: false,
  })
  is_read: boolean;

  @ApiProperty({
    description: 'Timestamp when the notification was created',
    example: '2026-10-28T12:00:00.000Z',
  })
  created_at: Date;
}

/**
 * Response payload containing the list of user notifications.
 */
export class NotificationListResponseDto {
  @ApiProperty({
    type: [NotificationItemDto],
    description: 'List of notifications for the authenticated user',
  })
  notification: NotificationItemDto[];
}
