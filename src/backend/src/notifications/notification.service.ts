import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CaslCheckAbility } from 'src/auth/casl/casl-checkAbility';
import { createHttpException, errors } from 'src/common/config/error.config';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private checkAbility: CaslCheckAbility,
  ) {}

  private async check(notificationId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
    });
    if (!notification) throw createHttpException(errors.notification.NotFound);
    if (!this.checkAbility.canAbility(notification.user))
      throw createHttpException(errors.notification.Forbidden);
    return notification;
  }

  async readNotification(notificationId: number) {
    await this.check(notificationId);
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        is_read: true,
      },
    });
  }

  async deleteNotification(notificationId: number) {
    await this.check(notificationId);
    await this.prisma.notification.delete({
      where: { id: notificationId },
    });
  }
  async getNotification(id: number) {
    return await this.prisma.notification.findMany({
      where: {
        user_id: id,
      },
    });
  }
}
