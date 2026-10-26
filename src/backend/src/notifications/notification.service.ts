import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { createHttpException, errors } from 'src/common/config/error.config';
import {
  AppSubject,
  CaslAbilityFactory,
} from 'src/auth/casl/casl-ability.factory/casl-ability.factory';
import { Action } from 'src/auth/casl/action.enum';
import { ActiveUserData } from 'src/common/decorators/current-user.decorator';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  private async checkNotify(notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw createHttpException(errors.notification.NotFound);
    return notification;
  }

  async readNotification(notificationId: number, user: ActiveUserData) {
    const notify = await this.checkNotify(notificationId);

    this.caslAbilityFactory.check(
      user,
      Action.Read,
      AppSubject.Notification,
      notify,
    );
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        is_read: true,
      },
    });
  }

  async deleteNotification(notificationId: number, user: ActiveUserData) {
    const notify = await this.checkNotify(notificationId);

    this.caslAbilityFactory.check(
      user,
      Action.Delete,
      AppSubject.Notification,
      notify,
    );
    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }

  async getNotifications(id: number) {
    return await this.prisma.notification.findMany({
      where: {
        user_id: id,
      },
    });
  }
}
