import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotificationSubject, NotificationAction } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { NotificationEmit } from './notification-emit';

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
              findUnique: jest.fn<() => Promise<any>>().mockResolvedValue({ username: 'Mario' }),
            },
            recipe: {
              findUnique: jest.fn(),
            },
            comment: {
              findUnique: jest.fn(),
            },
            friendship: {
              findMany: jest.fn(),
            },
            notification: {
              create: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 1 }),
              createMany: jest.fn<() => Promise<any>>().mockResolvedValue({ count: 2 }),
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

  describe('Broadcast to all friends (recipe post, update, delete)', () => {
    it('should broadcast post notification to all confirmed bidirectional friends', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
        { requester_id: 1, addressee_id: 2 },
        { requester_id: 3, addressee_id: 1 },
      ]);

      await service.notification(
        { id_user: 1, id_target: 100 },
        { subject: NotificationSubject.recipe, action: NotificationAction.post },
      );

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

      expect(prisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            user_id: 2,
            actor_id: 1,
            subject: NotificationSubject.recipe,
            action: NotificationAction.post,
            target_id: 100,
          },
          {
            user_id: 3,
            actor_id: 1,
            subject: NotificationSubject.recipe,
            action: NotificationAction.post,
            target_id: 100,
          },
        ],
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
        idUser: 2,
        message: 'Mario posted a new recipe',
        target: { subject: NotificationSubject.recipe, idTarget: 100 },
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
        idUser: 3,
        message: 'Mario posted a new recipe',
        target: { subject: NotificationSubject.recipe, idTarget: 100 },
      });
    });

    it('should broadcast recipe update to friends', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
        { requester_id: 1, addressee_id: 2 },
      ]);

      await service.notification(
        { id_user: 1, id_target: 50 },
        { subject: NotificationSubject.recipe, action: NotificationAction.update },
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
        idUser: 2,
        message: 'Mario update a recipe',
        target: { subject: NotificationSubject.recipe, idTarget: 50 },
      });
    });

    it('should not emit if user has no friends', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([]);

      await service.notification(
        { id_user: 1, id_target: 100 },
        { subject: NotificationSubject.recipe, action: NotificationAction.post },
      );

      expect(prisma.notification.createMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('Single-user notifications (like, comment, friend requests)', () => {
    it('should notify recipe author when someone likes their recipe', async () => {
      (prisma.recipe.findUnique as jest.Mock<any>).mockResolvedValue({
        id: 10,
        user_id: 99,
      });

      await service.notification(
        { id_user: 1, id_target: 10 },
        { subject: NotificationSubject.recipe, action: NotificationAction.like },
      );

      expect(prisma.recipe.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { user_id: true },
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          user_id: 99,
          actor_id: 1,
          subject: NotificationSubject.recipe,
          action: NotificationAction.like,
          target_id: 10,
        },
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
        idUser: 99,
        message: 'Mario liked your recipe',
        target: { subject: NotificationSubject.recipe, idTarget: 10 },
      });
    });

    it('should notify comment author when someone comments on it', async () => {
      (prisma.comment.findUnique as jest.Mock<any>).mockResolvedValue({
        id: 25,
        user_id: 77,
      });

      await service.notification(
        { id_user: 1, id_target: 25 },
        { subject: NotificationSubject.comment, action: NotificationAction.comment },
      );

      expect(prisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 25 },
        select: { user_id: true },
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
        idUser: 77,
        message: 'Mario replied to your comment',
        target: { subject: NotificationSubject.comment, idTarget: 25 },
      });
    });

    it('should notify target user directly for friend requests', async () => {
      await service.notification(
        { id_user: 1, id_target: 42 },
        { subject: NotificationSubject.user, action: NotificationAction.friend_request },
      );

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          user_id: 42,
          actor_id: 1,
          subject: NotificationSubject.user,
          action: NotificationAction.friend_request,
          target_id: 42,
        },
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('newNotification', {
        idUser: 42,
        message: 'Mario sent you a friend request',
        target: { subject: NotificationSubject.user, idTarget: 42 },
      });
    });

    it('should suppress self-notifications when author acts on own resource', async () => {
      (prisma.recipe.findUnique as jest.Mock<any>).mockResolvedValue({
        id: 10,
        user_id: 1, // Same as actor id_user
      });

      await service.notification(
        { id_user: 1, id_target: 10 },
        { subject: NotificationSubject.recipe, action: NotificationAction.like },
      );

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('should do nothing if target resource is not found', async () => {
      (prisma.recipe.findUnique as jest.Mock<any>).mockResolvedValue(null);

      await service.notification(
        { id_user: 1, id_target: 999 },
        { subject: NotificationSubject.recipe, action: NotificationAction.like },
      );

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});

