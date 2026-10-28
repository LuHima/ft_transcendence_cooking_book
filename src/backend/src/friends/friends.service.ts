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
   * Silently remove an established friendship.
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

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
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
        data: { status: 'accepted' },
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
      data: { status: 'accepted' },
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
   * Reject an incoming pending friend request, hard delete row and clean notifications.
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

    await this.prisma.friendship.delete({
      where: { id: pendingRequest.id },
    });

    // Cascading cleanup of notification in current user's inbox
    await this.prisma.notification.deleteMany({
      where: {
        user_id: userId,
        actor_id: requesterId,
        action: 'friend_request',
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
