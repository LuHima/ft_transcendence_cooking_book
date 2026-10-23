import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'prisma/prisma.service';
import { NotifyData } from 'src/common/decorators/notify.decorator';
import { NotificationStructDto } from 'src/common/dto/notification-struct.dto';

@Injectable()
export class NotificationEmit {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  private async notificationString(
    id_sender: number,
    notifyData: NotifyData,
  ): Promise<string> {
    const sender = await this.prisma.user.findUnique({
      where: { id: id_sender },
      select: { username: true },
    });
    const senderName = sender?.username || 'User';

    switch (notifyData.action) {
      case 'like':
        if (notifyData.subject === 'recipe') {
          return `${senderName} liked your recipe`;
        } else if (notifyData.subject === 'comment') {
          return `${senderName} liked your comment`;
        }
        return `${senderName} liked your post`;
      case 'comment':
        if (notifyData.subject === 'recipe') {
          return `${senderName} commented on your recipe`;
        }
        return `${senderName} replied to your comment`;
      case 'friend_request':
        return `${senderName} sent you a friend request`;
      case 'friend_accept':
        return `${senderName} accepted your friend request`;
      case 'post':
        return `${senderName} posted a new recipe`;
      default:
        return `New notification from ${senderName}`;
    }
  }

  private async fillNotificationTable(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ): Promise<void> {
    let targetUserIds: number[] = [];

    if (
      notifyData.action === 'friend_request' ||
      notifyData.action === 'friend_accept'
    ) {
      if (structNotify.id_target) {
        targetUserIds = [structNotify.id_target];
      }
    } else {
      // Fan-out to accepted bidirectional friends
      const friendships = await this.prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [
            { requester_id: structNotify.id_user },
            { addressee_id: structNotify.id_user },
          ],
        },
        select: { requester_id: true, addressee_id: true },
      });
      targetUserIds = friendships.map((f) =>
        f.requester_id === structNotify.id_user
          ? f.addressee_id
          : f.requester_id,
      );
    }

    if (targetUserIds.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: targetUserIds.map((userId) => ({
        user_id: userId,
        actor_id: structNotify.id_user,
        subject: notifyData.subject,
        action: notifyData.action,
        target_id: structNotify.id_target,
      })),
    });

    const msg = await this.notificationString(structNotify.id_user, notifyData);
    for (const userId of targetUserIds) {
      this.eventEmitter.emit('newNotification', {
        idUser: userId,
        message: msg,
      });
    }
  }

  public async notification(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ): Promise<void> {
    await this.fillNotificationTable(structNotify, notifyData);
  }
}
