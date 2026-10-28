import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationGateway } from './notification-gateway';

describe('NotificationGateway', () => {
  let gateway: NotificationGateway;
  let prisma: PrismaService;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    sockets: {
      adapter: {
        rooms: new Map<string, Set<string>>(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            friendship: {
              findMany: jest.fn(),
            },
            notification: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    gateway = module.get<NotificationGateway>(NotificationGateway);
    prisma = module.get<PrismaService>(PrismaService);
    gateway.server = mockServer as any;
    jest.clearAllMocks();
  });

  describe('handleNotificationEvent', () => {
    it('should forward notification with target payload to user room', () => {
      gateway.handleNotificationEvent({
        idUser: 42,
        message: 'Mario liked your recipe',
        target: { subject: 'recipe', idTarget: 10 },
      });

      expect(mockServer.to).toHaveBeenCalledWith('room-42');
      expect(mockServer.emit).toHaveBeenCalledWith('newNotification', {
        message: 'Mario liked your recipe',
        target: { subject: 'recipe', idTarget: 10 },
      });
    });
  });

  describe('User presence and friends status', () => {
    it('should query confirmed friends from friendships table', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
        { requester_id: 1, addressee_id: 2 },
        { requester_id: 3, addressee_id: 1 },
      ]);

      const friends = await (gateway as any).findFriend(1);

      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: {
          status: 'accepted',
          OR: [{ requester_id: 1 }, { addressee_id: 1 }],
        },
        select: {
          requester_id: true,
          addressee_id: true,
        },
      });

      expect(friends).toEqual([
        { friend_id: 2, follower_id: 2 },
        { friend_id: 3, follower_id: 3 },
      ]);
    });
  });
});

