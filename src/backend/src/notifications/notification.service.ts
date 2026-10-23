import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { createHttpException, errors } from 'src/common/config/error.config';
import { NotificationStatus } from '@prisma/client';
import { CaslAbilityFactory } from 'src/auth/casl/casl-ability.factory/casl-ability.factory';

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private caslAbilityFactory: CaslAbilityFactory,
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
            session: true,
          },
        },
      },
    });
    if (!notification) throw createHttpException(errors.notification.NotFound);
    const ability = this.caslAbilityFactory.createForUser(notification.user);
    ForbiddenError.from(ability).throwUnlessCan(
      Action.Update,
      subject('Recipe', recipe),
    );
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
