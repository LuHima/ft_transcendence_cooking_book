import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { PrismaService } from 'prisma/prisma.service';
import { CaslAbilityFactory } from 'src/auth/casl/casl-ability.factory/casl-ability.factory';
import { NotificationAction, NotificationSubject, Role } from '@prisma/client';
import { ActiveUserData } from 'src/common/decorators/current-user.decorator';
import { HttpStatus } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let prisma: {
    notification: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    recipe: {
      findMany: jest.Mock;
    };
    comment: {
      findMany: jest.Mock;
    };
  };

  const currentUser: ActiveUserData = {
    id: 1,
    role: Role.user,
    username: 'user1',
    session: 1,
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      recipe: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      comment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        CaslAbilityFactory,
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  describe('getNotifications', () => {
    it('1. Pagination & Order: should paginate and strictly order with newest first (created_at DESC)', async () => {
      const mockNotifications = [
        {
          id: 10,
          user_id: 1,
          actor_id: 2,
          subject: NotificationSubject.recipe,
          action: NotificationAction.like,
          target_id: 42,
          is_read: false,
          created_at: new Date('2026-10-29T10:00:00Z'),
          actor: {
            id: 2,
            username: 'mario',
            avatar_url: '/avatars/mario.webp',
          },
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(25) // total matching filter
        .mockResolvedValueOnce(5); // unread_count in inbox

      prisma.recipe.findMany.mockResolvedValue([
        {
          id: 42,
          source_lang: 'it',
          translations: [
            { locale: 'it', title: 'Pizza Margherita' },
            { locale: 'en', title: 'Margherita Pizza' },
          ],
        },
      ]);

      const result = await service.getNotifications(1, { page: 2, limit: 10 });

      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: { user_id: 1 },
        skip: 10,
        take: 10,
        orderBy: { created_at: 'desc' },
        include: {
          actor: {
            select: { id: true, username: true, avatar_url: true },
          },
        },
      });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.total_pages).toBe(3);
      expect(result.has_next_page).toBe(true);
      expect(result.has_prev_page).toBe(true);
      expect(result.unread_count).toBe(5);
      expect(result.items.length).toBe(1);
    });

    it('2. Unread Count: accurately reports global unread count regardless of page size or pagination', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(7); // global unread_count

      const result = await service.getNotifications(1, { page: 1, limit: 5 });

      expect(result.unread_count).toBe(7);
      expect(result.total).toBe(0);
      expect(result.total_pages).toBe(0);
      expect(result.has_next_page).toBe(false);
      expect(result.has_prev_page).toBe(false);
    });

    it('3. Unread Filter: passing unread_only=true retrieves strictly unread notifications', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      prisma.notification.count
        .mockResolvedValueOnce(3) // matching unread filter
        .mockResolvedValueOnce(3); // global unread_count

      await service.getNotifications(1, { unread_only: true });

      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 1, is_read: false },
        }),
      );
      expect(prisma.notification.count).toHaveBeenNthCalledWith(1, {
        where: { user_id: 1, is_read: false },
      });
      expect(prisma.notification.count).toHaveBeenNthCalledWith(2, {
        where: { user_id: 1, is_read: false },
      });
    });

    it('4. Actor Hydration: verifies actor contains id, username, and avatar_url', async () => {
      const mockNotifications = [
        {
          id: 1,
          user_id: 1,
          actor_id: 5,
          subject: NotificationSubject.user,
          action: NotificationAction.friend_request,
          target_id: 5,
          is_read: false,
          created_at: new Date('2026-10-30T10:00:00Z'),
          actor: {
            id: 5,
            username: 'giulia_chef',
            avatar_url: '/uploads/avatars/giulia.webp',
          },
        },
      ];

      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const result = await service.getNotifications(1, {});

      expect(result.items[0].actor).toEqual({
        id: 5,
        username: 'giulia_chef',
        avatar_url: '/uploads/avatars/giulia.webp',
      });
    });

    it('5. Target & Message Hydration: populates recipe title and localized message across it, en, and fr', async () => {
      const mockNotifications = [
        {
          id: 1,
          user_id: 1,
          actor_id: 2,
          subject: NotificationSubject.recipe,
          action: NotificationAction.like,
          target_id: 100,
          is_read: false,
          created_at: new Date('2026-10-30T10:00:00Z'),
          actor: {
            id: 2,
            username: 'marco',
            avatar_url: null,
          },
        },
        {
          id: 2,
          user_id: 1,
          actor_id: 3,
          subject: NotificationSubject.recipe,
          action: NotificationAction.comment,
          target_id: 100,
          is_read: false,
          created_at: new Date('2026-10-30T11:00:00Z'),
          actor: {
            id: 3,
            username: 'anna',
            avatar_url: null,
          },
        },
      ];

      prisma.recipe.findMany.mockResolvedValue([
        {
          id: 100,
          source_lang: 'it',
          translations: [
            { locale: 'it', title: 'Lasagna Bolognese' },
            { locale: 'en', title: 'Bolognese Lasagna' },
            { locale: 'fr', title: 'Lasagne à la bolognaise' },
          ],
        },
      ]);

      // Italian test
      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2);

      const itResult = await service.getNotifications(1, { lang: 'it' });
      expect(itResult.items[0].target.title_or_snippet).toBe(
        'Lasagna Bolognese',
      );
      expect(itResult.items[0].message).toBe(
        'marco ha messo "Mi piace" alla tua ricetta "Lasagna Bolognese"',
      );
      expect(itResult.items[1].message).toBe(
        'anna ha commentato la tua ricetta "Lasagna Bolognese"',
      );

      // English test (default)
      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2);

      const enResult = await service.getNotifications(1, { lang: 'en' });
      expect(enResult.items[0].target.title_or_snippet).toBe(
        'Bolognese Lasagna',
      );
      expect(enResult.items[0].message).toBe(
        'marco liked your recipe "Bolognese Lasagna"',
      );
      expect(enResult.items[1].message).toBe(
        'anna commented on your recipe "Bolognese Lasagna"',
      );

      // French test
      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2);

      const frResult = await service.getNotifications(1, { lang: 'fr' });
      expect(frResult.items[0].target.title_or_snippet).toBe(
        'Lasagne à la bolognaise',
      );
      expect(frResult.items[0].message).toBe(
        'marco a aimé votre recette "Lasagne à la bolognaise"',
      );
      expect(frResult.items[1].message).toBe(
        'anna a commenté votre recette "Lasagne à la bolognaise"',
      );
    });

    it('5b. Comment replies and friendship notification messages across languages', async () => {
      const mockNotifications = [
        {
          id: 10,
          user_id: 1,
          actor_id: 2,
          subject: NotificationSubject.comment,
          action: NotificationAction.comment,
          target_id: 50,
          is_read: false,
          created_at: new Date('2026-10-30T10:00:00Z'),
          actor: {
            id: 2,
            username: 'luca',
            avatar_url: null,
          },
        },
        {
          id: 11,
          user_id: 1,
          actor_id: 3,
          subject: NotificationSubject.user,
          action: NotificationAction.friend_request,
          target_id: 3,
          is_read: false,
          created_at: new Date('2026-10-30T11:00:00Z'),
          actor: {
            id: 3,
            username: 'elena',
            avatar_url: null,
          },
        },
        {
          id: 12,
          user_id: 1,
          actor_id: 4,
          subject: NotificationSubject.user,
          action: NotificationAction.friend_accept,
          target_id: 4,
          is_read: false,
          created_at: new Date('2026-10-30T12:00:00Z'),
          actor: {
            id: 4,
            username: 'davide',
            avatar_url: null,
          },
        },
      ];

      prisma.comment.findMany.mockResolvedValue([
        { id: 50, content: 'Ottima ricetta!' },
      ]);

      // IT
      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(3);

      const itResult = await service.getNotifications(1, { lang: 'it' });
      expect(itResult.items[0].target.title_or_snippet).toBe('Ottima ricetta!');
      expect(itResult.items[0].message).toBe(
        'luca ha risposto al tuo commento',
      );
      expect(itResult.items[1].message).toBe(
        'elena ti ha inviato una richiesta di amicizia',
      );
      expect(itResult.items[2].message).toBe(
        'davide ha accettato la tua richiesta di amicizia',
      );

      // EN
      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(3);

      const enResult = await service.getNotifications(1, { lang: 'en' });
      expect(enResult.items[0].message).toBe('luca replied to your comment');
      expect(enResult.items[1].message).toBe('elena sent you a friend request');
      expect(enResult.items[2].message).toBe(
        'davide accepted your friend request',
      );

      // FR
      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(3);

      const frResult = await service.getNotifications(1, { lang: 'fr' });
      expect(frResult.items[0].message).toBe(
        'luca a répondu à votre commentaire',
      );
      expect(frResult.items[1].message).toBe(
        "elena vous a envoyé une demande d'ami",
      );
      expect(frResult.items[2].message).toBe(
        "davide a accepté votre demande d'ami",
      );
    });
  });

  describe('markAllAsRead', () => {
    it('6. Read-All Bulk Action: marks all unread notifications as read in a single updateMany query', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.markAllAsRead(1);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { user_id: 1, is_read: false },
        data: { is_read: true },
      });
      expect(result).toEqual({ message: 'All notifications marked as read' });
    });
  });

  describe('readNotification', () => {
    it('7. Single Read Action: marks specific notification as read for recipient', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 10,
        user_id: 1,
        is_read: false,
      });
      prisma.notification.update.mockResolvedValue({
        id: 10,
        user_id: 1,
        is_read: true,
      });

      const result = await service.readNotification(10, currentUser);

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { is_read: true },
      });
      expect(result).toEqual({ message: 'Read' });
    });

    it('9. Authorization Invariant: throws 403 Forbidden when reading another user notification', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 10,
        user_id: 2, // belongs to user 2
        is_read: false,
      });

      await expect(
        service.readNotification(10, currentUser), // user 1 calls it
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.FORBIDDEN,
        }),
      );
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('10. Not Found Invariant: throws 404 Not Found when notification ID does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(service.readNotification(999, currentUser)).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.NOT_FOUND,
        }),
      );
    });
  });

  describe('deleteNotification', () => {
    it('8. Delete Action: permanently removes notification from database', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 15,
        user_id: 1,
      });
      prisma.notification.delete.mockResolvedValue({
        id: 15,
        user_id: 1,
      });

      const result = await service.deleteNotification(15, currentUser);

      expect(prisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 15 },
      });
      expect(result).toEqual({ message: 'Deleted successfully' });
    });

    it('9. Authorization Invariant: throws 403 Forbidden when deleting another user notification', async () => {
      prisma.notification.findUnique.mockResolvedValue({
        id: 15,
        user_id: 2, // belongs to user 2
      });

      await expect(
        service.deleteNotification(15, currentUser), // user 1 calls it
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.FORBIDDEN,
        }),
      );
      expect(prisma.notification.delete).not.toHaveBeenCalled();
    });

    it('10. Not Found Invariant: throws 404 Not Found when notification ID does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteNotification(999, currentUser),
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.NOT_FOUND,
        }),
      );
    });
  });
});
