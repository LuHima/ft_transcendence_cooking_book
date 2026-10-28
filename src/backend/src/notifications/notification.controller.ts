import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import {
  ActiveUserData,
  CurrentUser,
} from 'src/common/decorators/current-user.decorator';
import { Auth } from 'src/common/decorators/policies.decorator';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Auth()
  @Patch('read/:id')
  async readedNotification(
    @Param('id', ParseIntPipe) idNotifi: number,
    @CurrentUser() user,
  ) {
    await this.notificationService.readNotification(idNotifi, user);
    return { message: 'Read' };
  }

  @Auth()
  @Delete('delete/:id')
  async deleteNotification(
    @Param('id', ParseIntPipe) idNotifi: number,
    @CurrentUser() user,
  ) {
    await this.notificationService.deleteNotification(idNotifi, user);
    return { message: 'Deleted successfully' };
  }

  @Auth()
  @Get()
  async getNotification(@CurrentUser('id') id: number) {
    const notification = await this.notificationService.getNotifications(id);
    return { notification };
  }
}
