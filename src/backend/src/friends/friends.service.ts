import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
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
  private static readonly REJECTED_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

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
   * Silently remove an established friendship and prune unread notifications atomically.
   */
  async removeFriend(
    userId: number,
    friendId: number,
  ): Promise<FriendMessageResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const friendship = await tx.friendship.findFirst({
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

      const deleted = await tx.friendship.deleteMany({
        where: { id: friendship.id, status: 'accepted' },
      });
      if (deleted.count === 0) {
        throw new NotFoundException('Friendship not found');
      }

      await tx.notification.deleteMany({
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
    });

    return { message: 'Friend removed successfully' };
  }

  private findPairFriendship(
    client: Prisma.TransactionClient | PrismaService,
    userA: number,
    userB: number,
  ) {
    return client.friendship.findFirst({
      where: {
        OR: [
          { requester_id: userA, addressee_id: userB },
          { requester_id: userB, addressee_id: userA },
        ],
      },
    });
  }

  private async acceptPendingFriendshipInTx(
    tx: Prisma.TransactionClient,
    friendshipId: number,
    accepterId: number,
    requesterId: number,
  ): Promise<void> {
    const updated = await tx.friendship.updateMany({
      where: { id: friendshipId, status: 'pending' },
      data: {
        status: 'accepted',
        updated_at: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new NotFoundException('Friend request not found');
    }

    await tx.notification.deleteMany({
      where: {
        user_id: accepterId,
        actor_id: requesterId,
        action: NotificationAction.friend_request,
      },
    });
  }

  private async assertTargetActiveAndUnblocked(
    tx: Prisma.TransactionClient,
    currentUserId: number,
    targetUserId: number,
    notFoundMessage: string,
  ): Promise<void> {
    const isBlocked = await tx.userBlock.findFirst({
      where: {
        OR: [
          { blocker_id: currentUserId, blocked_id: targetUserId },
          { blocker_id: targetUserId, blocked_id: currentUserId },
        ],
      },
      select: { id: true },
    });
    if (isBlocked) {
      throw new NotFoundException(notFoundMessage);
    }

    const targetUser = await tx.user.findFirst({
      where: { id: targetUserId, status: 'active', deleted_at: null },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException(notFoundMessage);
    }
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

    const runTransition = async (): Promise<{
      result: FriendRequestActionResponseDto;
      notifyAction?: NotificationAction;
    }> => {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertTargetActiveAndUnblocked(
          tx,
          requesterId,
          recipientId,
          'User not found',
        );

        const existing = await this.findPairFriendship(
          tx,
          requesterId,
          recipientId,
        );

        if (existing) {
          if (existing.status === 'accepted') {
            throw new ConflictException('Already friends with this user');
          }

          if (existing.status === 'pending') {
            if (existing.requester_id === requesterId) {
              throw new ConflictException('Friend request already sent');
            }

            // Counter-request from recipient -> auto-accept atomically
            await this.acceptPendingFriendshipInTx(
              tx,
              existing.id,
              requesterId,
              recipientId,
            );
            return {
              result: {
                message: 'Friend request accepted',
                status: 'accepted',
              },
              notifyAction: NotificationAction.friend_accept,
            };
          }

          // existing.status === 'rejected'
          if (existing.requester_id === requesterId) {
            const elapsed = Date.now() - existing.updated_at.getTime();
            if (elapsed < FriendsService.REJECTED_COOLDOWN_MS) {
              throw new ConflictException(
                'Friend request cannot be sent to this user',
              );
            }
            await tx.friendship.update({
              where: { id: existing.id },
              data: {
                status: 'pending',
                updated_at: new Date(),
              },
            });
          } else {
            // Reverse request was rejected: rejecter now initiates without cooldown
            await tx.friendship.update({
              where: { id: existing.id },
              data: {
                requester_id: requesterId,
                addressee_id: recipientId,
                status: 'pending',
                updated_at: new Date(),
              },
            });
          }

          return {
            result: { message: 'Friend request sent', status: 'pending' },
            notifyAction: NotificationAction.friend_request,
          };
        }

        await tx.friendship.create({
          data: {
            requester_id: requesterId,
            addressee_id: recipientId,
            status: 'pending',
          },
        });

        return {
          result: { message: 'Friend request sent', status: 'pending' },
          notifyAction: NotificationAction.friend_request,
        };
      });
    };

    const executeTransition =
      async (): Promise<FriendRequestActionResponseDto> => {
        const outcome = await runTransition();
        if (outcome.notifyAction) {
          await this.notificationEmit.notification(
            { id_user: requesterId, id_target: recipientId },
            {
              subject: NotificationSubject.user,
              action: outcome.notifyAction,
            },
          );
        }
        return outcome.result;
      };

    try {
      return await executeTransition();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Concurrent request hit the pair unique constraint: re-evaluate the winner row
        const raced = await this.findPairFriendship(
          this.prisma,
          requesterId,
          recipientId,
        );
        if (raced?.status === 'pending' && raced.requester_id === recipientId) {
          await this.prisma.$transaction(async (tx) => {
            await this.acceptPendingFriendshipInTx(
              tx,
              raced.id,
              requesterId,
              recipientId,
            );
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
        if (raced?.status === 'accepted') {
          throw new ConflictException('Already friends with this user');
        }
        if (raced?.status === 'rejected') {
          if (raced.requester_id === requesterId) {
            if (
              Date.now() - raced.updated_at.getTime() <
              FriendsService.REJECTED_COOLDOWN_MS
            ) {
              throw new ConflictException(
                'Friend request cannot be sent to this user',
              );
            }
          }
          return await executeTransition();
        }
        // Idempotent double-click from same requester
        return { message: 'Friend request sent', status: 'pending' };
      }
      throw error;
    }
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
   * Explicitly accept an incoming pending friend request atomically.
   */
  async acceptFriendRequest(
    userId: number,
    requesterId: number,
  ): Promise<FriendRequestActionResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.assertTargetActiveAndUnblocked(
        tx,
        userId,
        requesterId,
        'Friend request not found',
      );

      const pendingRequest = await tx.friendship.findFirst({
        where: {
          requester_id: requesterId,
          addressee_id: userId,
          status: 'pending',
        },
      });

      if (!pendingRequest) {
        throw new NotFoundException('Friend request not found');
      }

      await this.acceptPendingFriendshipInTx(
        tx,
        pendingRequest.id,
        userId,
        requesterId,
      );
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
   * Reject an incoming pending friend request atomically, update row to rejected
   * (enforcing 30-day cooldown), and clean up notifications.
   */
  async rejectFriendRequest(
    userId: number,
    requesterId: number,
  ): Promise<FriendRequestActionResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.assertTargetActiveAndUnblocked(
        tx,
        userId,
        requesterId,
        'Friend request not found',
      );

      const pendingRequest = await tx.friendship.findFirst({
        where: {
          requester_id: requesterId,
          addressee_id: userId,
          status: 'pending',
        },
      });

      if (!pendingRequest) {
        throw new NotFoundException('Friend request not found');
      }

      const updated = await tx.friendship.updateMany({
        where: { id: pendingRequest.id, status: 'pending' },
        data: {
          status: 'rejected',
          updated_at: new Date(),
        },
      });
      if (updated.count === 0) {
        throw new NotFoundException('Friend request not found');
      }

      // Cascading cleanup of notification in current user's inbox
      await tx.notification.deleteMany({
        where: {
          user_id: userId,
          actor_id: requesterId,
          action: NotificationAction.friend_request,
        },
      });
    });

    return { message: 'Friend request rejected' };
  }

  /**
   * Cancel an outgoing pending friend request atomically, hard delete row and clean notifications.
   */
  async cancelFriendRequest(
    userId: number,
    addresseeId: number,
  ): Promise<FriendRequestActionResponseDto> {
    await this.prisma.$transaction(async (tx) => {
      const pendingRequest = await tx.friendship.findFirst({
        where: {
          requester_id: userId,
          addressee_id: addresseeId,
          status: 'pending',
        },
      });

      if (!pendingRequest) {
        throw new NotFoundException('Friend request not found');
      }

      const deleted = await tx.friendship.deleteMany({
        where: { id: pendingRequest.id, status: 'pending' },
      });
      if (deleted.count === 0) {
        throw new NotFoundException('Friend request not found');
      }

      // Cascading cleanup of notification in recipient's inbox
      await tx.notification.deleteMany({
        where: {
          user_id: addresseeId,
          actor_id: userId,
          action: 'friend_request',
        },
      });
    });

    return { message: 'Friend request cancelled' };
  }
}
