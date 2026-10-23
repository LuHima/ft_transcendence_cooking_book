import { subject } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationSubject } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotifyData } from 'src/common/decorators/notify.decorator';
import { NotificationStructDto } from 'src/common/dto/notification-struct.dto';

interface targetInfo{
  idTarget: number;
  subject: string;
}

@Injectable()
export class NotificationEmit {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}
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
  private findTargetTable(
    idTarget: number,
    subject: NotificationSubject | string
  ) : number{
    let target;
    if (subject == NotificationSubject.recipe) {
      target = this.prisma.recipe.findUnique({
        where: {
          id: idTarget,
        },
        select :{
          id: true,
        }
      });
    }
    if (subject == NotificationSubject.user) {
      target = this.prisma.follow.findMany({
        where: {
          id: idTarget,
        },
        select :{
          id: true,
        }
      });
    }
    if (subject == NotificationSubject.comment) {
      target = this.prisma.comment.findUnique({
        where: {
          id: idTarget,
        },
        select :{
          recipe_id: true,
        }
      });
    }
    
    return target.id;
  }
  private async fillNotificationTable(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ) {
    const friends = await this.prisma.follow.findMany({
      where: { following_id: structNotify.id_user },
      select: { follower_id: true },
    });
    await this.prisma.notification.createMany({
      data: friends.map((f) => ({
        user_id: f.follower_id,
        actor_id: structNotify.id_user,
        subject: notifyData.subject,
        action: notifyData.action,
        target_id: structNotify.id_target,
      })),
    });
    const target = {
      id: await this.findTargetTable(structNotify.id_user ,notifyData.subject),
      subject: notifyData.subject,
    }
    const msg = await this.notificationString(structNotify.id_user, notifyData);
    for (const f of friends) {
      this.eventEmitter.emit('newNotification', {
        idUser: f.follower_id,
        message: msg,
        infoTarget: 
      });
    }
  }

  public async notification(
    structNotify: NotificationStructDto,
    notifyData: NotifyData,
  ) {
    await this.fillNotificationTable(structNotify, notifyData);
  }
}
