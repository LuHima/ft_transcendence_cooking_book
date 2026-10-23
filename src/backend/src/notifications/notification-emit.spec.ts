import { Test, TestingModule } from '@nestjs/testing';
import { NotificationEmit } from './notification-emit';
import { PrismaService } from 'prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('NotificationEmit', () => {
  let service: NotificationEmit;
  let prisma: PrismaService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationEmit,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ username: 'mario' }),
            },
            friendship: {
              findMany: jest.fn(),
            },
            notification: {
              createMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 1 }),
            },
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationEmit>(NotificationEmit);
    prisma = module.get<PrismaService>(PrismaService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should broadcast post notification to all accepted bidirectional friends', async () => {
    (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
      { requester_id: 1, addressee_id: 2 },
      { requester_id: 3, addressee_id: 1 },
    ]);

    await service.notification(
      { id_user: 1, id_target: 100 },
      { subject: 'recipe', action: 'post' },
    );

    expect(prisma.friendship.findMany).toHaveBeenCalledWith({
      where: {
        status: 'accepted',
        OR: [{ requester_id: 1 }, { addressee_id: 1 }],
      },
      select: { requester_id: true, addressee_id: true },
    });

    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 2,
          actor_id: 1,
          subject: 'recipe',
          action: 'post',
          target_id: 100,
        },
        {
          user_id: 3,
          actor_id: 1,
          subject: 'recipe',
          action: 'post',
          target_id: 100,
        },
      ],
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
      idUser: 2,
      message: 'mario posted a new recipe',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
      idUser: 3,
      message: 'mario posted a new recipe',
    });
  });

  it('should send 1-to-1 friend_request notification to target recipient', async () => {
    await service.notification(
      { id_user: 1, id_target: 2 },
      { subject: 'user', action: 'friend_request' },
    );

    expect(prisma.friendship.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 2,
          actor_id: 1,
          subject: 'user',
          action: 'friend_request',
          target_id: 2,
        },
      ],
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
      idUser: 2,
      message: 'mario sent you a friend request',
    });
  });

  it('should send 1-to-1 friend_accept notification to target recipient', async () => {
    await service.notification(
      { id_user: 2, id_target: 1 },
      { subject: 'user', action: 'friend_accept' },
    );

    expect(prisma.friendship.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 1,
          actor_id: 2,
          subject: 'user',
          action: 'friend_accept',
          target_id: 1,
        },
      ],
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
      idUser: 1,
      message: 'mario accepted your friend request',
    });
  });
});
