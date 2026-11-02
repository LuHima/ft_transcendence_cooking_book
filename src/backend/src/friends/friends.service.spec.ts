import { Test, TestingModule } from '@nestjs/testing';
import { FriendsService } from './friends.service';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationEmit } from 'src/notifications/notification-emit';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('FriendsService', () => {
  let service: FriendsService;
  let prisma: PrismaService;
  let notificationEmit: NotificationEmit;

  const mockDate = new Date('2026-10-15T12:00:00Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: PrismaService,
          useValue: {
            friendship: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            notification: {
              deleteMany: jest.fn(),
            },
            userBlock: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: NotificationEmit,
          useValue: {
            notification: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<FriendsService>(FriendsService);
    prisma = module.get<PrismaService>(PrismaService);
    notificationEmit = module.get<NotificationEmit>(NotificationEmit);
  });

  describe('getFriends', () => {
    it('should return paginated confirmed friends with counterparty mapping', async () => {
      const mockFriendships = [
        {
          id: 1,
          requester_id: 1,
          addressee_id: 2,
          status: 'accepted',
          updated_at: mockDate,
          requester: { id: 1, username: 'mario', avatar_url: null },
          addressee: {
            id: 2,
            username: 'giulia',
            avatar_url: '/avatar_2.webp',
          },
        },
        {
          id: 2,
          requester_id: 3,
          addressee_id: 1,
          status: 'accepted',
          updated_at: mockDate,
          requester: { id: 3, username: 'marco', avatar_url: null },
          addressee: { id: 1, username: 'mario', avatar_url: null },
        },
      ];

      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue(
        mockFriendships,
      );
      (prisma.friendship.count as jest.Mock<any>).mockResolvedValue(2);

      const result = await service.getFriends(1, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        id: 2,
        username: 'giulia',
        avatar_url: '/avatar_2.webp',
        friends_since: mockDate,
      });
      expect(result.items[1]).toEqual({
        id: 3,
        username: 'marco',
        avatar_url: null,
        friends_since: mockDate,
      });
      expect(result.total).toBe(2);
      expect(result.total_pages).toBe(1);
    });

    it('should apply case-insensitive search filter across counterparty username', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([]);
      (prisma.friendship.count as jest.Mock<any>).mockResolvedValue(0);

      await service.getFriends(1, { page: 1, limit: 10, search: 'giu' });

      expect(prisma.friendship.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'accepted',
            OR: [
              {
                requester_id: 1,
                addressee: {
                  username: { contains: 'giu', mode: 'insensitive' },
                },
              },
              {
                addressee_id: 1,
                requester: {
                  username: { contains: 'giu', mode: 'insensitive' },
                },
              },
            ],
          }),
        }),
      );
    });
  });

  describe('removeFriend', () => {
    it('should silently delete an established friendship and prune unread notifications', async () => {
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValue({
        id: 10,
        status: 'accepted',
      });
      (prisma.friendship.delete as jest.Mock<any>).mockResolvedValue({
        id: 10,
      });
      (prisma.notification.deleteMany as jest.Mock<any>).mockResolvedValue({
        count: 2,
      });

      const result = await service.removeFriend(1, 2);

      expect(result).toEqual({ message: 'Friend removed successfully' });
      expect(prisma.friendship.delete).toHaveBeenCalledWith({
        where: { id: 10 },
      });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { user_id: 1, actor_id: 2 },
            { user_id: 2, actor_id: 1 },
          ],
          action: { in: ['friend_request', 'friend_accept'] },
          is_read: false,
        },
      });
    });

    it('should throw NotFoundException if friendship does not exist', async () => {
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValue(null);

      await expect(service.removeFriend(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('sendFriendRequest', () => {
    it('should throw BadRequestException when sending request to self', async () => {
      await expect(service.sendFriendRequest(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when recipient does not exist or is inactive', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue(null);

      await expect(service.sendFriendRequest(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when either user has blocked the other', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      (prisma.userBlock.findFirst as jest.Mock<any>).mockResolvedValueOnce({
        id: 1,
        blocker_id: 2,
        blocked_id: 1,
      });

      await expect(service.sendFriendRequest(1, 2)).rejects.toThrow(
        new NotFoundException('User not found'),
      );
    });

    it('should throw ConflictException if already friends', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValueOnce({
        id: 5,
        status: 'accepted',
      });

      await expect(service.sendFriendRequest(1, 2)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if pending request already sent', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      (prisma.friendship.findFirst as jest.Mock<any>)
        .mockResolvedValueOnce(null) // no accepted
        .mockResolvedValueOnce({ id: 8, status: 'pending' }); // already sent

      await expect(service.sendFriendRequest(1, 2)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if recipient rejected request within 30 days', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      (prisma.friendship.findFirst as jest.Mock<any>)
        .mockResolvedValueOnce(null) // no accepted
        .mockResolvedValueOnce(null) // no outgoing pending
        .mockResolvedValueOnce({
          id: 9,
          requester_id: 1,
          addressee_id: 2,
          status: 'rejected',
          updated_at: tenDaysAgo,
        }); // rejected within cooldown

      await expect(service.sendFriendRequest(1, 2)).rejects.toThrow(
        new ConflictException('Friend request cannot be sent to this user'),
      );
    });

    it('should re-activate request if recipient rejected request more than 30 days ago', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      (prisma.friendship.findFirst as jest.Mock<any>)
        .mockResolvedValueOnce(null) // no accepted
        .mockResolvedValueOnce(null) // no outgoing pending
        .mockResolvedValueOnce({
          id: 9,
          requester_id: 1,
          addressee_id: 2,
          status: 'rejected',
          updated_at: fortyDaysAgo,
        }); // rejected past cooldown

      (prisma.friendship.update as jest.Mock<any>).mockResolvedValue({
        id: 9,
        status: 'pending',
      });

      const result = await service.sendFriendRequest(1, 2);

      expect(result).toEqual({
        message: 'Friend request sent',
        status: 'pending',
      });
      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 9 },
        data: {
          status: 'pending',
          updated_at: expect.any(Date),
        },
      });
      expect(notificationEmit.notification).toHaveBeenCalledWith(
        { id_user: 1, id_target: 2 },
        { subject: 'user', action: 'friend_request' },
      );
    });

    it('should allow user who previously rejected a request to initiate request at any time', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      (prisma.friendship.findFirst as jest.Mock<any>)
        .mockResolvedValueOnce(null) // no accepted
        .mockResolvedValueOnce(null) // no outgoing pending
        .mockResolvedValueOnce(null) // no outgoing rejected (requester -> recipient)
        .mockResolvedValueOnce({
          id: 11,
          requester_id: 2,
          addressee_id: 1,
          status: 'rejected',
          updated_at: twoDaysAgo,
        }); // incoming rejected (recipient was rejected by requester)

      (prisma.friendship.update as jest.Mock<any>).mockResolvedValue({
        id: 11,
        requester_id: 1,
        addressee_id: 2,
        status: 'pending',
      });

      const result = await service.sendFriendRequest(1, 2);

      expect(result).toEqual({
        message: 'Friend request sent',
        status: 'pending',
      });
      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 11 },
        data: {
          requester_id: 1,
          addressee_id: 2,
          status: 'pending',
          updated_at: expect.any(Date),
        },
      });
      expect(notificationEmit.notification).toHaveBeenCalledWith(
        { id_user: 1, id_target: 2 },
        { subject: 'user', action: 'friend_request' },
      );
    });

    it('should auto-accept if recipient already sent pending request and prune caller notification', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      (prisma.friendship.findFirst as jest.Mock<any>)
        .mockResolvedValueOnce(null) // no accepted
        .mockResolvedValueOnce(null) // no outgoing pending
        .mockResolvedValueOnce(null) // no outgoing rejected
        .mockResolvedValueOnce(null) // no reverse rejected
        .mockResolvedValueOnce({
          id: 12,
          requester_id: 2,
          addressee_id: 1,
          status: 'pending',
        }); // incoming pending

      (prisma.friendship.update as jest.Mock<any>).mockResolvedValue({
        id: 12,
        status: 'accepted',
      });
      (prisma.notification.deleteMany as jest.Mock<any>).mockResolvedValue({
        count: 1,
      });

      const result = await service.sendFriendRequest(1, 2);

      expect(result).toEqual({
        message: 'Friend request accepted',
        status: 'accepted',
      });
      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 12 },
        data: {
          status: 'accepted',
          updated_at: expect.any(Date),
        },
      });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          actor_id: 2,
          action: 'friend_request',
        },
      });
      expect(notificationEmit.notification).toHaveBeenCalledWith(
        { id_user: 1, id_target: 2 },
        { subject: 'user', action: 'friend_accept' },
      );
    });

    it('should idempotently handle duplicate requests when unique constraint collision occurs', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      (prisma.friendship.findFirst as jest.Mock<any>)
        .mockResolvedValueOnce(null) // no accepted
        .mockResolvedValueOnce(null) // no outgoing pending
        .mockResolvedValueOnce(null) // no outgoing rejected
        .mockResolvedValueOnce(null) // no reverse rejected
        .mockResolvedValueOnce(null); // no incoming pending

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint violation',
        { code: 'P2002', clientVersion: '7.8.0' },
      );
      (prisma.friendship.create as jest.Mock<any>).mockRejectedValue(
        p2002Error,
      );

      const result = await service.sendFriendRequest(1, 2);

      expect(result).toEqual({
        message: 'Friend request sent',
        status: 'pending',
      });
    });

    it('should create pending request and emit notification when no prior relation exists', async () => {
      (prisma.user.findFirst as jest.Mock<any>).mockResolvedValue({ id: 2 });
      (prisma.friendship.findFirst as jest.Mock<any>)
        .mockResolvedValueOnce(null) // no accepted
        .mockResolvedValueOnce(null) // no outgoing pending
        .mockResolvedValueOnce(null) // no outgoing rejected
        .mockResolvedValueOnce(null) // no reverse rejected
        .mockResolvedValueOnce(null); // no incoming pending

      (prisma.friendship.create as jest.Mock<any>).mockResolvedValue({
        id: 15,
        requester_id: 1,
        addressee_id: 2,
        status: 'pending',
      });

      const result = await service.sendFriendRequest(1, 2);

      expect(result).toEqual({
        message: 'Friend request sent',
        status: 'pending',
      });
      expect(prisma.friendship.create).toHaveBeenCalledWith({
        data: { requester_id: 1, addressee_id: 2, status: 'pending' },
      });
      expect(notificationEmit.notification).toHaveBeenCalledWith(
        { id_user: 1, id_target: 2 },
        { subject: 'user', action: 'friend_request' },
      );
    });
  });

  describe('getFriendRequests', () => {
    it('should list incoming pending requests', async () => {
      const mockPending = [
        {
          id: 1,
          requester_id: 3,
          addressee_id: 1,
          created_at: mockDate,
          requester: { id: 3, username: 'marco', avatar_url: null },
          addressee: { id: 1, username: 'mario', avatar_url: null },
        },
      ];
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue(
        mockPending,
      );
      (prisma.friendship.count as jest.Mock<any>).mockResolvedValue(1);

      const result = await service.getFriendRequests(1, { type: 'incoming' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 3,
        username: 'marco',
        avatar_url: null,
        created_at: mockDate,
      });
    });

    it('should list outgoing pending requests', async () => {
      const mockPending = [
        {
          id: 2,
          requester_id: 1,
          addressee_id: 4,
          created_at: mockDate,
          requester: { id: 1, username: 'mario', avatar_url: null },
          addressee: { id: 4, username: 'sophie', avatar_url: null },
        },
      ];
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue(
        mockPending,
      );
      (prisma.friendship.count as jest.Mock<any>).mockResolvedValue(1);

      const result = await service.getFriendRequests(1, { type: 'outgoing' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 4,
        username: 'sophie',
        avatar_url: null,
        created_at: mockDate,
      });
    });
  });

  describe('acceptFriendRequest', () => {
    it('should accept pending request, emit notification, and delete incoming request notification', async () => {
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValue({
        id: 20,
        status: 'pending',
      });
      (prisma.friendship.update as jest.Mock<any>).mockResolvedValue({
        id: 20,
        status: 'accepted',
      });
      (prisma.notification.deleteMany as jest.Mock<any>).mockResolvedValue({
        count: 1,
      });

      const result = await service.acceptFriendRequest(1, 2);

      expect(result).toEqual({ message: 'Friend request accepted' });
      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 20 },
        data: {
          status: 'accepted',
          updated_at: expect.any(Date),
        },
      });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          user_id: 1,
          actor_id: 2,
          action: 'friend_request',
        },
      });
      expect(notificationEmit.notification).toHaveBeenCalledWith(
        { id_user: 1, id_target: 2 },
        { subject: 'user', action: 'friend_accept' },
      );
    });

    it('should throw NotFoundException if request does not exist', async () => {
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValue(null);

      await expect(service.acceptFriendRequest(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rejectFriendRequest', () => {
    it('should update pending request to rejected status and cascade cleanup notification in inbox', async () => {
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValue({
        id: 25,
        status: 'pending',
      });
      (prisma.friendship.update as jest.Mock<any>).mockResolvedValue({
        id: 25,
        status: 'rejected',
      });
      (prisma.notification.deleteMany as jest.Mock<any>).mockResolvedValue({
        count: 1,
      });

      const result = await service.rejectFriendRequest(1, 2);

      expect(result).toEqual({ message: 'Friend request rejected' });
      expect(prisma.friendship.update).toHaveBeenCalledWith({
        where: { id: 25 },
        data: {
          status: 'rejected',
          updated_at: expect.any(Date),
        },
      });
      expect(prisma.friendship.delete).not.toHaveBeenCalled();
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 1, actor_id: 2, action: 'friend_request' },
      });
    });

    it('should throw NotFoundException if request not found', async () => {
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValue(null);

      await expect(service.rejectFriendRequest(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelFriendRequest', () => {
    it('should delete pending outgoing request and clean notification in recipient inbox', async () => {
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValue({
        id: 30,
        status: 'pending',
      });
      (prisma.friendship.delete as jest.Mock<any>).mockResolvedValue({
        id: 30,
      });
      (prisma.notification.deleteMany as jest.Mock<any>).mockResolvedValue({
        count: 1,
      });

      const result = await service.cancelFriendRequest(1, 2);

      expect(result).toEqual({ message: 'Friend request cancelled' });
      expect(prisma.friendship.delete).toHaveBeenCalledWith({
        where: { id: 30 },
      });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 2, actor_id: 1, action: 'friend_request' },
      });
    });

    it('should throw NotFoundException if request not found', async () => {
      (prisma.friendship.findFirst as jest.Mock<any>).mockResolvedValue(null);

      await expect(service.cancelFriendRequest(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
