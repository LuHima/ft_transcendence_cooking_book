import { Test, TestingModule } from '@nestjs/testing';
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

    it('should forward warning notification omitting staff credentials', () => {
      gateway.handleNotificationEvent({
        idUser: 42,
        message:
          'You received a warning from the moderation team about your recipe',
        target: { subject: 'recipe', idTarget: 10 },
      });

      expect(mockServer.to).toHaveBeenCalledWith('room-42');
      expect(mockServer.emit).toHaveBeenCalledWith('newNotification', {
        message:
          'You received a warning from the moderation team about your recipe',
        target: { subject: 'recipe', idTarget: 10 },
      });
    });
  });

  describe('handleConnection & unreadNotifications shielding', () => {
    it('masks actor_id to null for warn notifications when emitting unreadNotifications', async () => {
      const mockClient = {
        handshake: {
          headers: {
            cookie: 'accessToken=valid.jwt.token',
          },
        },
        data: {},
        join: jest.fn(),
        emit: jest.fn(),
      };

      jest
        .spyOn(gateway as any, 'findToken')
        .mockReturnValue('valid.jwt.token');
      jest.spyOn(gateway as any, 'handleJwtVerification').mockReturnValue({
        sub: 10,
        type: 'access',
      });
      jest.spyOn(gateway as any, 'statusUser').mockResolvedValue(undefined);

      (prisma.notification.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 1,
          user_id: 10,
          actor_id: 99,
          action: 'warn',
          subject: 'recipe',
          target_id: 5,
        },
        {
          id: 2,
          user_id: 10,
          actor_id: 3,
          action: 'like',
          subject: 'recipe',
          target_id: 5,
        },
      ]);

      await gateway.handleConnection(mockClient as any);

      expect(mockClient.emit).toHaveBeenCalledWith('unreadNotifications', {
        notification: [
          expect.objectContaining({
            id: 1,
            action: 'warn',
            actor_id: null,
          }),
          expect.objectContaining({
            id: 2,
            action: 'like',
            actor_id: 3,
          }),
        ],
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

