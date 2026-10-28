import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import {
  NotificationListResponseDto,
  NotificationMessageResponseDto,
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
   * Mark a notification as read.
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
  @Patch('read/:id')
  async readedNotification(
    @Param('id', ParseIntPipe) idNotifi: number,
    @CurrentUser() user: ActiveUserData,
  ) {
    await this.notificationService.readNotification(idNotifi, user);
    return { message: 'Read' };
  }

  /**
   * Delete a notification.
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
  @Delete('delete/:id')
  async deleteNotification(
    @Param('id', ParseIntPipe) idNotifi: number,
    @CurrentUser() user: ActiveUserData,
  ) {
    await this.notificationService.deleteNotification(idNotifi, user);
    return { message: 'Deleted successfully' };
  }

  /**
   * Retrieve all notifications for the authenticated user.
   */
  @ApiOperation({
    summary: 'Get user notifications',
    description:
      'Retrieves all notifications for the authenticated user, ordered by creation date.',
  })
  @ApiOkResponse({
    description: 'List of notifications for the authenticated user',
    type: NotificationListResponseDto,
  })
  @Auth()
  @Get()
  async getNotification(@CurrentUser('id') id: number) {
    const notification = await this.notificationService.getNotifications(id);
    return { notification };
  }
}
