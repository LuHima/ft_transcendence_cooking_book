import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationSubject, NotificationAction } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotifyData } from 'src/common/decorators/notify.decorator';
import { NotificationStructDto } from 'src/common/dto/notification-struct.dto';

interface targetnotification {
  tableId: number;
  userId: number;
}

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
      case 'delete':
        return `${senderName} delete a recipe`;
      case 'update':
        return `${senderName} update a recipe`;
      default:
        return `New notification from ${senderName}`;
    }
  }

  private async findFriends(id: number): Promise<number[]> {
    const friends = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requester_id: id }, { addressee_id: id }],
      },
      select: {
        requester_id: true,
        addressee_id: true,
      },
    });

    const friendIds: number[] = [];
    for (const f of friends) {
      if (f.requester_id === id) {
        friendIds.push(f.addressee_id);
      } else {
        friendIds.push(f.requester_id);
      }
    }
    return friendIds;
  }

  private async findUser(
    idTarget: number,
    subject: NotificationSubject | string,
  ): Promise<number | undefined> {
    let targetnotification: targetnotification;
    if (subject === NotificationSubject.recipe) {
      const target = await this.prisma.recipe.findUnique({
        where: { id: idTarget },
        select: { user_id: true },
      });

      return target?.user_id ?? undefined;
    }
    if (subject === NotificationSubject.comment) {
      const target = await this.prisma.comment.findUnique({
        where: { id: idTarget },
        select: { user_id: true },
      });

      return target?.user_id ?? undefined;
    }
    if (subject === NotificationSubject.user) {
      return idTarget;
    }
    return undefined;
  }

  private async writeToASingleUser(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ) {
    const target = await this.findUser(
      structNotify.id_target,
      notifyData.subject,
    );

    if (!target || target === structNotify.id_user) return;
    await this.prisma.notification.create({
      data: {
        user_id: target,
        actor_id: structNotify.id_user,
        subject: notifyData.subject,
        action: notifyData.action,
        target_id: structNotify.id_target,
      },
    });

    const targetInfo = {
      subject: notifyData.subject,
      idTarget: structNotify.id_target,
    };

    const msg = await this.notificationString(structNotify.id_user, notifyData);
    this.eventEmitter.emit('newNotification', {
      idUser: target,
      message: msg,
      target: targetInfo,
    });
  }

  private async writeToAllFriend(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ): Promise<void> {
    const friends = await this.findFriends(structNotify.id_user);
    if (friends.length === 0) return;

    await this.prisma.notification.createMany({
      data: friends.map((userId) => ({
        user_id: userId,
        actor_id: structNotify.id_user,
        subject: notifyData.subject,
        action: notifyData.action,
        target_id: structNotify.id_target,
      })),
    });

    const targetInfo = {
      subject: notifyData.subject,
      idTarget: structNotify.id_target,
    };

    const msg = await this.notificationString(structNotify.id_user, notifyData);
    for (const userId of friends) {
      this.eventEmitter.emit('newNotification', {
        idUser: userId,
        message: msg,
        target: targetInfo,
      });
    }
  }

  private async fillNotificationTable(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ): Promise<void> {
    if (
      notifyData.subject === NotificationSubject.recipe &&
      (notifyData.action === NotificationAction.post ||
        notifyData.action === NotificationAction.update ||
        notifyData.action === NotificationAction.delete)
    ) {
      await this.writeToAllFriend(structNotify, notifyData);
      return;
    }
    await this.writeToASingleUser(structNotify, notifyData);
  }

  public async notification(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ): Promise<void> {
    await this.fillNotificationTable(structNotify, notifyData);
  }
}
