import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationEmit } from 'src/notifications/notification-emit';
import {
  NotificationAction,
  NotificationSubject,
  Prisma,
} from '@prisma/client';
import { FriendQueryDto } from './dto/friend-query.dto';
import {
  FriendItemDto,
  FriendMessageResponseDto,
  PaginatedFriendsResponseDto,
} from './dto/friend-response.dto';
import { FriendRequestQueryDto } from './dto/friend-request-query.dto';
import {
  FriendRequestActionResponseDto,
  FriendRequestItemDto,
  PaginatedFriendRequestsResponseDto,
} from './dto/friend-request-response.dto';

@Injectable()
export class FriendsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEmit: NotificationEmit,
  ) {}

  /**
   * List confirmed friends for the given user with pagination and optional search filter.
   */
  async getFriends(
    userId: number,
    query: FriendQueryDto = new FriendQueryDto(),
  ): Promise<PaginatedFriendsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search?.trim();

    const whereClause: Prisma.FriendshipWhereInput = search
      ? {
          status: 'accepted',
          OR: [
            {
              requester_id: userId,
              addressee: {
                username: { contains: search, mode: 'insensitive' },
              },
            },
            {
              addressee_id: userId,
              requester: {
                username: { contains: search, mode: 'insensitive' },
              },
            },
          ],
        }
      : {
          status: 'accepted',
          OR: [{ requester_id: userId }, { addressee_id: userId }],
        };

    const [friendships, total] = await Promise.all([
      this.prisma.friendship.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { updated_at: 'desc' },
        include: {
          requester: {
            select: { id: true, username: true, avatar_url: true },
          },
          addressee: {
            select: { id: true, username: true, avatar_url: true },
          },
        },
      }),
      this.prisma.friendship.count({ where: whereClause }),
    ]);

    const items: FriendItemDto[] = friendships.map((f) => {
      const counterparty =
        f.requester_id === userId ? f.addressee : f.requester;
      return {
        id: counterparty.id,
        username: counterparty.username,
        avatar_url: counterparty.avatar_url,
        friends_since: f.updated_at,
      };
    });

    const total_pages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    };
  }

  /**
   * Silently remove an established friendship and prune unread notifications.
   */
  async removeFriend(
    userId: number,
    friendId: number,
  ): Promise<FriendMessageResponseDto> {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requester_id: userId, addressee_id: friendId },
          { requester_id: friendId, addressee_id: userId },
        ],
      },
    });

    if (!friendship) {
      throw new NotFoundException('Friendship not found');
    }

    await this.prisma.friendship.delete({
      where: { id: friendship.id },
    });

    await this.prisma.notification.deleteMany({
      where: {
        OR: [
          { user_id: userId, actor_id: friendId },
          { user_id: friendId, actor_id: userId },
        ],
        action: {
          in: [
            NotificationAction.friend_request,
            NotificationAction.friend_accept,
          ],
        },
        is_read: false,
      },
    });

    return { message: 'Friend removed successfully' };
  }

  /**
   * Send a friend request or auto-accept if a pending counter-request exists.
   */
  async sendFriendRequest(
    requesterId: number,
    recipientId: number,
  ): Promise<FriendRequestActionResponseDto> {
    if (requesterId === recipientId) {
      throw new BadRequestException('Cannot send friend request to yourself');
    }

    const recipient = await this.prisma.user.findFirst({
      where: {
        id: recipientId,
        status: 'active',
        deleted_at: null,
      },
      select: { id: true },
    });
    if (!recipient) {
      throw new NotFoundException('User not found');
    }

    const existingFriendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'accepted',
        OR: [
          { requester_id: requesterId, addressee_id: recipientId },
          { requester_id: recipientId, addressee_id: requesterId },
        ],
      },
    });
    if (existingFriendship) {
      throw new ConflictException('Already friends with this user');
    }

    const sentPending = await this.prisma.friendship.findFirst({
      where: {
        requester_id: requesterId,
        addressee_id: recipientId,
        status: 'pending',
      },
    });
    if (sentPending) {
      throw new ConflictException('Friend request already sent');
    }

    // Check Rejection Cooldown:
    // If outgoing request was previously rejected, enforce 30-day cooldown
    const existingRejected = await this.prisma.friendship.findFirst({
      where: {
        requester_id: requesterId,
        addressee_id: recipientId,
        status: 'rejected',
      },
    });
    if (existingRejected) {
      const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
      const elapsed = Date.now() - existingRejected.updated_at.getTime();
      if (elapsed < COOLDOWN_MS) {
        throw new ConflictException(
          'Friend request cannot be sent to this user',
        );
      }
      await this.prisma.friendship.update({
        where: { id: existingRejected.id },
        data: {
          status: 'pending',
          updated_at: new Date(),
        },
      });
      await this.notificationEmit.notification(
        { id_user: requesterId, id_target: recipientId },
        {
          subject: NotificationSubject.user,
          action: NotificationAction.friend_request,
        },
      );
      return { message: 'Friend request sent', status: 'pending' };
    }

    // If reverse request was rejected (the rejecter now initiates a request to the rejected member),
    // allow the request without cooldown, flipping requester/addressee and transitioning to pending.
    const reverseRejected = await this.prisma.friendship.findFirst({
      where: {
        requester_id: recipientId,
        addressee_id: requesterId,
        status: 'rejected',
      },
    });
    if (reverseRejected) {
      await this.prisma.friendship.update({
        where: { id: reverseRejected.id },
        data: {
          requester_id: requesterId,
          addressee_id: recipientId,
          status: 'pending',
          updated_at: new Date(),
        },
      });
      await this.notificationEmit.notification(
        { id_user: requesterId, id_target: recipientId },
        {
          subject: NotificationSubject.user,
          action: NotificationAction.friend_request,
        },
      );
      return { message: 'Friend request sent', status: 'pending' };
    }

    // Cross-request auto-accept
    const incomingPending = await this.prisma.friendship.findFirst({
      where: {
        requester_id: recipientId,
        addressee_id: requesterId,
        status: 'pending',
      },
    });

    if (incomingPending) {
      await this.prisma.friendship.update({
        where: { id: incomingPending.id },
        data: {
          status: 'accepted',
          updated_at: new Date(),
        },
      });

      // Prune caller's incoming request notification
      await this.prisma.notification.deleteMany({
        where: {
          user_id: requesterId,
          actor_id: recipientId,
          action: NotificationAction.friend_request,
        },
      });

      await this.notificationEmit.notification(
        { id_user: requesterId, id_target: recipientId },
        {
          subject: NotificationSubject.user,
          action: NotificationAction.friend_accept,
        },
      );

      return {
        message: 'Friend request accepted',
        status: 'accepted',
      };
    }

    try {
      await this.prisma.friendship.create({
        data: {
          requester_id: requesterId,
          addressee_id: recipientId,
          status: 'pending',
        },
      });

      await this.notificationEmit.notification(
        { id_user: requesterId, id_target: recipientId },
        {
          subject: NotificationSubject.user,
          action: NotificationAction.friend_request,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Idempotent double-click success
        return { message: 'Friend request sent', status: 'pending' };
      }
      throw error;
    }

    return {
      message: 'Friend request sent',
      status: 'pending',
    };
  }

  /**
   * List pending friend requests (incoming or outgoing).
   */
  async getFriendRequests(
    userId: number,
    query: FriendRequestQueryDto = new FriendRequestQueryDto(),
  ): Promise<PaginatedFriendRequestsResponseDto> {
    const type = query.type ?? 'incoming';
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const isIncoming = type === 'incoming';
    const whereClause: Prisma.FriendshipWhereInput = isIncoming
      ? { addressee_id: userId, status: 'pending' }
      : { requester_id: userId, status: 'pending' };

    const [requests, total] = await Promise.all([
      this.prisma.friendship.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          requester: {
            select: { id: true, username: true, avatar_url: true },
          },
          addressee: {
            select: { id: true, username: true, avatar_url: true },
          },
        },
      }),
      this.prisma.friendship.count({ where: whereClause }),
    ]);

    const items: FriendRequestItemDto[] = requests.map((r) => {
      const counterparty = isIncoming ? r.requester : r.addressee;
      return {
        id: counterparty.id,
        username: counterparty.username,
        avatar_url: counterparty.avatar_url,
        created_at: r.created_at,
      };
    });

    const total_pages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    };
  }

  /**
   * Explicitly accept an incoming pending friend request.
   */
  async acceptFriendRequest(
    userId: number,
    requesterId: number,
  ): Promise<FriendRequestActionResponseDto> {
    const pendingRequest = await this.prisma.friendship.findFirst({
      where: {
        requester_id: requesterId,
        addressee_id: userId,
        status: 'pending',
      },
    });

    if (!pendingRequest) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.friendship.update({
      where: { id: pendingRequest.id },
      data: {
        status: 'accepted',
        updated_at: new Date(),
      },
    });

    // Permanently delete incoming friend_request notification from recipient's inbox
    await this.prisma.notification.deleteMany({
      where: {
        user_id: userId,
        actor_id: requesterId,
        action: NotificationAction.friend_request,
      },
    });

    await this.notificationEmit.notification(
      { id_user: userId, id_target: requesterId },
      {
        subject: NotificationSubject.user,
        action: NotificationAction.friend_accept,
      },
    );

    return { message: 'Friend request accepted' };
  }

  /**
   * Reject an incoming pending friend request, update row to rejected (enforcing 30-day cooldown),
   * and clean up notifications.
   */
  async rejectFriendRequest(
    userId: number,
    requesterId: number,
  ): Promise<FriendRequestActionResponseDto> {
    const pendingRequest = await this.prisma.friendship.findFirst({
      where: {
        requester_id: requesterId,
        addressee_id: userId,
        status: 'pending',
      },
    });

    if (!pendingRequest) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.friendship.update({
      where: { id: pendingRequest.id },
      data: {
        status: 'rejected',
        updated_at: new Date(),
      },
    });

    // Cascading cleanup of notification in current user's inbox
    await this.prisma.notification.deleteMany({
      where: {
        user_id: userId,
        actor_id: requesterId,
        action: NotificationAction.friend_request,
      },
    });

    return { message: 'Friend request rejected' };
  }

  /**
   * Cancel an outgoing pending friend request, hard delete row and clean notifications.
   */
  async cancelFriendRequest(
    userId: number,
    addresseeId: number,
  ): Promise<FriendRequestActionResponseDto> {
    const pendingRequest = await this.prisma.friendship.findFirst({
      where: {
        requester_id: userId,
        addressee_id: addresseeId,
        status: 'pending',
      },
    });

    if (!pendingRequest) {
      throw new NotFoundException('Friend request not found');
    }

    await this.prisma.friendship.delete({
      where: { id: pendingRequest.id },
    });

    // Cascading cleanup of notification in recipient's inbox
    await this.prisma.notification.deleteMany({
      where: {
        user_id: addresseeId,
        actor_id: userId,
        action: 'friend_request',
      },
    });

    return { message: 'Friend request cancelled' };
  }
}
