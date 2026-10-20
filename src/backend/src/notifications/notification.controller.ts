import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { Action } from 'src/auth/casl/action.enum';
import { CaslCheckAbility } from 'src/auth/casl/casl-checkAbility';
import { createHttpException, errors } from 'src/common/config/error.config';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Notify } from 'src/common/decorators/notify.decorator';
import { Auth } from 'src/common/decorators/policies.decorator';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Auth(Action.Read, 'Notification')
  @Patch('read/:id')
  async readedNotification(@Param('id', ParseIntPipe) idNotifi: number) {
    await this.notificationService.readNotification(idNotifi);
    return { message: 'Read' };
  }

  @Auth(Action.Delete, 'Notification')
  @Delete('delete/:id')
  async deleteNotification(@Param('id', ParseIntPipe) idNotifi: number) {
    await this.notificationService.deleteNotification(idNotifi);
    return { message: 'Deleted successfully' };
  }

  @Auth()
  @Get('get')
  async getNotification(@CurrentUser('id') id: number) {
    const notification = await this.notificationService.getNotification(id);
    return { notification };
  }
  /*   @Auth(Action.Accept, 'Notification')
  @Patch('FriendRequest/:id')
  async AcceptFriendRequest(@Query('id', ParseIntPipe) idNotifi: number) {
    await this.AcceptFriendRequest(idNotifi);
    return { message: 'Friend Request accepted' };
  }

  @Auth(Action.Refuse, 'Notification')
  @Delete('FriendRequest/:id')
  async RefuseFriendRequest(@Query('id', ParseIntPipe) idNotifi: number) {
    await this.RefuseFriendRequest(idNotifi);
    return { message: 'Friend Request refused' };
  } */
}
