import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { ActiveUserData } from 'src/common/decorators/current-user.decorator';
import { Auth } from 'src/common/decorators/policies.decorator';
import { NotificationService } from './notification.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import {
  NotificationMessageResponseDto,
  PaginatedNotificationResponseDto,
} from './dto/notification-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiForbiddenResponseDto,
  ApiNotFoundResponseDto,
  ApiInternalServerErrorResponseDto,
} from 'src/common/dto/api-error-response.dto';

/**
 * Controller handling user notifications, marking notifications as read, and inbox cleanup.
 */
@ApiTags('Notifications')
@ApiInternalServerErrorResponse({
  type: ApiInternalServerErrorResponseDto,
  description: 'Internal server error',
})
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * Retrieve paginated, sorted, and hydrated notifications for the authenticated user.
   */
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Retrieves paginated, sorted, and hydrated notifications for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Paginated notifications with actor and target metadata',
    type: PaginatedNotificationResponseDto,
  })
  @Auth()
  @Get()
  async getNotifications(
    @CurrentUser('id') userId: number,
    @Query() query: NotificationQueryDto,
  ): Promise<PaginatedNotificationResponseDto> {
    return await this.notificationService.getNotifications(userId, query);
  }

  /**
   * Mark all notifications as read in bulk.
   */
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description:
      'Marks all unread notifications for the authenticated user as read in a single operation.',
  })
  @ApiOkResponse({
    description: 'All notifications marked as read',
    type: NotificationMessageResponseDto,
  })
  @Auth()
  @Patch('read-all')
  async markAllAsRead(
    @CurrentUser('id') userId: number,
  ): Promise<NotificationMessageResponseDto> {
    return await this.notificationService.markAllAsRead(userId);
  }

  /**
   * Mark a single notification as read.
   */
  @ApiOperation({
    summary: 'Mark notification as read',
    description:
      'Marks a specific notification as read. The authenticated user must be the recipient.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Numeric notification ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Notification marked as read',
    type: NotificationMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid notification ID format (must be an integer)',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: user is not the recipient of the notification',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Notification not found',
    type: ApiNotFoundResponseDto,
  })
  @Auth()
  @Patch(':id/read')
  async readNotification(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ActiveUserData,
  ): Promise<NotificationMessageResponseDto> {
    return await this.notificationService.readNotification(id, user);
  }

  /**
   * Permanently delete a notification.
   */
  @ApiOperation({
    summary: 'Delete notification',
    description:
      'Permanently deletes a notification from the inbox. The authenticated user must be the recipient.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Numeric notification ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Notification deleted successfully',
    type: NotificationMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid notification ID format (must be an integer)',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: user is not the recipient of the notification',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Notification not found',
    type: ApiNotFoundResponseDto,
  })
  @Auth()
  @Delete(':id')
  async deleteNotification(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: ActiveUserData,
  ): Promise<NotificationMessageResponseDto> {
    return await this.notificationService.deleteNotification(id, user);
  }
}
