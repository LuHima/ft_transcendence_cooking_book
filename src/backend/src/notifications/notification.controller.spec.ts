import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { JwtService } from '@nestjs/jwt';
import { ActiveUserData } from 'src/common/decorators/current-user.decorator';
import { NotificationAction, NotificationSubject, Role } from '@prisma/client';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { PaginatedNotificationResponseDto } from './dto/notification-response.dto';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: {
    getNotifications: jest.Mock;
    markAllAsRead: jest.Mock;
    readNotification: jest.Mock;
    deleteNotification: jest.Mock;
  };

  const mockUser: ActiveUserData = {
    id: 1,
    role: Role.user,
    username: 'user1',
    session: 1,
  };

  beforeEach(async () => {
    service = {
      getNotifications: jest.fn(),
      markAllAsRead: jest.fn(),
      readNotification: jest.fn(),
      deleteNotification: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: service,
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<NotificationController>(NotificationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications (GET /notifications)', () => {
    it('delegates to NotificationService.getNotifications with userId and query params', async () => {
      const query: NotificationQueryDto = {
        page: 2,
        limit: 15,
        unread_only: true,
        lang: 'it',
      };

      const mockResponse: PaginatedNotificationResponseDto = {
        items: [
          {
            id: 1,
            user_id: 1,
            actor: {
              id: 2,
              username: 'mario',
              avatar_url: null,
            },
            subject: NotificationSubject.recipe,
            action: NotificationAction.like,
            target: {
              id: 10,
              subject: NotificationSubject.recipe,
              title_or_snippet: 'Pizza Margherita',
            },
            message:
              'mario ha messo "Mi piace" alla tua ricetta "Pizza Margherita"',
            is_read: false,
            created_at: new Date(),
          },
        ],
        total: 1,
        page: 2,
        limit: 15,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: true,
        unread_count: 1,
      };

      service.getNotifications.mockResolvedValue(mockResponse);

      const result = await controller.getNotifications(mockUser.id, query);

      expect(service.getNotifications).toHaveBeenCalledWith(mockUser.id, query);
      expect(result).toBe(mockResponse);
    });
  });

  describe('markAllAsRead (PATCH /notifications/read-all)', () => {
    it('delegates to NotificationService.markAllAsRead with userId and returns confirmation message', async () => {
      const mockResult = { message: 'All notifications marked as read' };
      service.markAllAsRead.mockResolvedValue(mockResult);

      const result = await controller.markAllAsRead(mockUser.id);

      expect(service.markAllAsRead).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockResult);
    });
  });

  describe('readNotification (PATCH /notifications/:id/read)', () => {
    it('delegates to NotificationService.readNotification with id and current user', async () => {
      const mockResult = { message: 'Read' };
      service.readNotification.mockResolvedValue(mockResult);

      const result = await controller.readNotification(42, mockUser);

      expect(service.readNotification).toHaveBeenCalledWith(42, mockUser);
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteNotification (DELETE /notifications/:id)', () => {
    it('delegates to NotificationService.deleteNotification with id and current user', async () => {
      const mockResult = { message: 'Deleted successfully' };
      service.deleteNotification.mockResolvedValue(mockResult);

      const result = await controller.deleteNotification(42, mockUser);

      expect(service.deleteNotification).toHaveBeenCalledWith(42, mockUser);
      expect(result).toEqual(mockResult);
    });
  });
});
