import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationSubject, NotificationAction } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotifyData } from 'src/common/decorators/notify.decorator';
import { NotificationStructDto } from 'src/common/dto/notification-struct.dto';

interface targetInfo {
  idTarget: number;
  subject: string;
}

@Injectable()
export class NotificationEmit {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  private async findFriends(id: number) {
    const friends = await this.prisma.follow.findMany({
      where: {
        OR: [{ sender_id: id }, { receiver_id: id }],
        status: 'accepted',
      },
      select: {
        sender_id: true,
        receiver_id: true,
      },
    });
    const friendIds: number[] = [];
    for (const f of friends) {
      if (f.sender_id === id) {
        friendIds.push(f.receiver_id);
      } else {
        friendIds.push(f.sender_id);
      }
    }
    return friendIds;
  }

  private async findUser(id: number) {
    const friends = await this.prisma.follow.findMany({
      where: {
        OR: [{ sender_id: id }, { receiver_id: id }],
        status: 'accepted',
      },
      select: {
        sender_id: true,
        receiver_id: true,
      },
    });
    const friendIds: number[] = [];
    for (const f of friends) {
      if (f.sender_id === id) {
        friendIds.push(f.receiver_id);
      } else {
        friendIds.push(f.sender_id);
      }
    }
    return friendIds;
  }

  private async notificationString(id_sender: number, notifyData: NotifyData) {
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
          return `${senderName} liked your recipe`;
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
  private async findTargetTable(
    idTarget: number,
    subject: NotificationSubject | string,
  ): Promise<number | undefined> {
    if (subject == NotificationSubject.recipe) {
      const target = await this.prisma.recipe.findUnique({
        where: {
          id: idTarget,
        },
        select: {
          id: true,
        },
      });
      return target?.id;
    }
    if (subject == NotificationSubject.user) {
      const target = await this.prisma.follow.findUnique({
        where: {
          id: idTarget,
        },
        select: {
          id: true,
        },
      });
      return target?.id;
    }
    if (subject == NotificationSubject.comment) {
      const target = await this.prisma.comment.findUnique({
        where: {
          id: idTarget,
        },
        select: {
          recipe_id: true,
        },
      });
      return target?.recipe_id;
    }

    return undefined;
  }

  private async writeToAllFriend(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ) {
    const friends = await this.findFriends(structNotify.id_user);
    await this.prisma.notification.createMany({
      data: friends.map((f) => ({
        user_id: f,
        actor_id: structNotify.id_user,
        subject: notifyData.subject,
        action: notifyData.action,
        target_id: structNotify.id_target,
      })),
    });
    const target = {
      id: await this.findTargetTable(
        structNotify.id_target,
        notifyData.subject,
      ),
      subject: notifyData.subject,
    };
    const msg = await this.notificationString(structNotify.id_user, notifyData);
    for (const f of friends) {
      this.eventEmitter.emit('newNotification', {
        idUser: f,
        message: msg,
        target: target,
      });
    }
  }

  private async writeToASingleUser(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ) {
    const user = this.findUser
  }
  private async fillNotificationTable(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ) {
    if (
      notifyData.subject === NotificationSubject.recipe &&
      (notifyData.action === NotificationAction.post ||
        notifyData.action === NotificationAction.update ||
        notifyData.action === NotificationAction.delete)
    ) {
      this.writeToAllFriend(structNotify, notifyData);
      return;
    }
    this.writeToASingleUser(structNotify, notifyData);
  }

  public async notification(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ) {
    await this.fillNotificationTable(structNotify, notifyData);
  }
}
