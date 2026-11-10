import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { UserSortBy, SortOrder } from './dto/search-user-query.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUser = {
    id: 1,
    username: 'mario',
    email: 'mario@example.com',
    role: 'user',
    avatar_url: 'https://example.com/avatar.jpg',
    first_name: 'Mario',
    last_name: 'Rossi',
    birth_date: new Date('1990-01-01'),
    phone: '+39123456789',
    address: 'Via Roma 1',
    city: 'Firenze',
    postal_code: '50100',
    created_at: new Date('2026-09-01T10:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getMe: jest.fn().mockResolvedValue(mockUser),
            updateMe: jest.fn(),
            updateAvatar: jest.fn(),
            deleteAvatar: jest.fn(),
            getLikedRecipes: jest.fn(),
            getMyRecipes: jest.fn(),
            findUser: jest.fn(),
            findUsers: jest.fn(),
            getUser: jest.fn(),
            getUserByUsername: jest.fn(),
            getUserPublicRecipes: jest.fn(),
            getUserFriends: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  describe('getMe', () => {
    it('should return the full profile of the authenticated user', async () => {
      const result = await controller.getMe(1);

      expect(result).toEqual(mockUser);
      expect(service.getMe).toHaveBeenCalledWith(1);
    });
  });

  describe('updateMe', () => {
    it('should update and return the updated user profile', async () => {
      const updateDto = {
        first_name: 'Luigi',
        city: 'Milano',
      };
      const updatedUser = { ...mockUser, ...updateDto };
      (service.updateMe as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(updatedUser);

      const result = await controller.updateMe(1, updateDto);

      expect(result).toEqual(updatedUser);
      expect(service.updateMe).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('updateAvatar', () => {
    it('should upload avatar and return avatar_url', async () => {
      const mockFile = { filename: 'avatar-123.jpg' } as Express.Multer.File;
      const mockResponse = {
        avatar_url: '/api/media/avatars/1/avatar-123.jpg',
      };
      (service.updateAvatar as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockResponse);

      const result = await controller.updateAvatar(1, mockFile);

      expect(result).toEqual(mockResponse);
      expect(service.updateAvatar).toHaveBeenCalledWith(1, mockFile);
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar and return success message', async () => {
      const mockResponse = { message: 'Avatar deleted successfully' };
      (service.deleteAvatar as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockResponse);

      const result = await controller.deleteAvatar(1);

      expect(result).toEqual(mockResponse);
      expect(service.deleteAvatar).toHaveBeenCalledWith(1);
    });
  });

  describe('getLikedRecipes', () => {
    it('should return liked recipes for the authenticated user', async () => {
      const mockRecipes = {
        items: [{ id: 10, title: 'Carbonara' }],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getLikedRecipes as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockRecipes);

      const query = { page: 1, limit: 20, lang: 'it' as const };
      const result = await controller.getLikedRecipes(1, query);

      expect(result).toEqual(mockRecipes);
      expect(service.getLikedRecipes).toHaveBeenCalledWith(1, query);
    });
  });

  describe('getMyRecipes', () => {
    it('should return authored recipes for the authenticated user', async () => {
      const mockRecipes = {
        items: [{ id: 101, title: 'Tiramisù' }],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getMyRecipes as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockRecipes);

      const query = { page: 1, limit: 20, lang: 'it' as const };
      const result = await controller.getMyRecipes(1, query);

      expect(result).toEqual(mockRecipes);
      expect(service.getMyRecipes).toHaveBeenCalledWith(1, query);
    });
  });

  describe('findUsers', () => {
    it('should delegate to service.findUsers with query and currentUserId', async () => {
      const mockResult = {
        items: [
          {
            id: 2,
            username: 'giulia',
            avatar_url: '/uploads/avatars/avatar_2.webp',
            first_name: 'Giulia',
            last_name: 'Bianchi',
            created_at: new Date('2026-09-01T10:00:00Z'),
            recipes_count: 5,
            friendship_status: 'friends' as const,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.findUsers as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const query = {
        page: 1,
        limit: 20,
        search: 'giulia',
        sort_by: UserSortBy.username,
        sort_order: SortOrder.asc,
      };
      const result = await controller.findUsers(query, 1);

      expect(result).toEqual(mockResult);
      expect(service.findUsers).toHaveBeenCalledWith(query, 1);
    });

    it('should delegate to service.findUsers without currentUserId for unauthenticated visitor', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.findUsers as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20 };
      const result = await controller.findUsers(query, undefined);

      expect(result).toEqual(mockResult);
      expect(service.findUsers).toHaveBeenCalledWith(query, undefined);
    });
  });

  describe('getUserByUsername', () => {
    it('should delegate to service.getUserByUsername with username and currentUserId', async () => {
      const publicUser = {
        id: 2,
        username: 'giulia',
        first_name: 'Giulia',
        last_name: 'Bianchi',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Passionate cook',
        created_at: new Date('2026-09-01T10:00:00Z'),
        recipes_count: 5,
        friends_count: 10,
        total_likes_received: 25,
        friendship_status: 'friends',
      };
      (service.getUserByUsername as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(publicUser);

      const result = await controller.getUserByUsername('giulia', 1);

      expect(result).toEqual(publicUser);
      expect(service.getUserByUsername).toHaveBeenCalledWith('giulia', 1);
    });

    it('should delegate to service.getUserByUsername without currentUserId for unauthenticated caller', async () => {
      const publicUser = {
        id: 2,
        username: 'giulia',
        first_name: 'Giulia',
        last_name: 'Bianchi',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: null,
        created_at: new Date('2026-09-01T10:00:00Z'),
        recipes_count: 0,
        friends_count: 0,
        total_likes_received: 0,
        friendship_status: null,
      };
      (service.getUserByUsername as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(publicUser);

      const result = await controller.getUserByUsername('giulia', undefined);

      expect(result).toEqual(publicUser);
      expect(service.getUserByUsername).toHaveBeenCalledWith(
        'giulia',
        undefined,
      );
    });
  });

  describe('getUser', () => {
    it('should delegate to service.getUser with user id and currentUserId', async () => {
      const publicUser = {
        id: 2,
        username: 'giulia',
        first_name: 'Giulia',
        last_name: 'Bianchi',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Passionate cook',
        created_at: new Date('2026-09-01T10:00:00Z'),
        recipes_count: 5,
        friends_count: 10,
        total_likes_received: 25,
        friendship_status: 'friends',
      };
      (service.getUser as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(publicUser);

      const result = await controller.getUser(2, 1);

      expect(result).toEqual(publicUser);
      expect(service.getUser).toHaveBeenCalledWith(2, 1);
    });
  });

  describe('getUserPublicRecipes', () => {
    it('should delegate to service.getUserPublicRecipes with id, query, and currentUserId', async () => {
      const mockResult = {
        items: [
          {
            id: 10,
            title: 'Pasta al Pesto',
            is_liked: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getUserPublicRecipes as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20, lang: 'it' as const };
      const result = await controller.getUserPublicRecipes(2, query, 1);

      expect(result).toEqual(mockResult);
      expect(service.getUserPublicRecipes).toHaveBeenCalledWith(2, query, 1);
    });

    it('should delegate to service.getUserPublicRecipes without currentUserId for unauthenticated caller', async () => {
      const mockResult = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getUserPublicRecipes as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockResult);

      const query = { page: 1, limit: 20 };
      const result = await controller.getUserPublicRecipes(2, query, undefined);

      expect(result).toEqual(mockResult);
      expect(service.getUserPublicRecipes).toHaveBeenCalledWith(
        2,
        query,
        undefined,
      );
    });
  });

  describe('getUserFriends', () => {
    it('should delegate to service.getUserFriends with target id and query', async () => {
      const mockFriends = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getUserFriends as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockFriends);

      const query = { page: 1, limit: 20 };
      const result = await controller.getUserFriends(2, query);

      expect(result).toEqual(mockFriends);
      expect(service.getUserFriends).toHaveBeenCalledWith(2, query, undefined);
    });
  });

  describe('getBlockedUsers', () => {
    it('should delegate to service.getBlockedUsers with current user id and query', async () => {
      const mockEnvelope = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getBlockedUsers as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue(mockEnvelope);

      const query = { page: 1, limit: 20 };
      const result = await controller.getBlockedUsers(1, query);

      expect(result).toEqual(mockEnvelope);
      expect(service.getBlockedUsers).toHaveBeenCalledWith(1, query);
    });
  });

  describe('blockUser', () => {
    it('should delegate to service.blockUser with blockerId and targetId', async () => {
      (service.blockUser as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue({ message: 'User blocked successfully' });

      const result = await controller.blockUser(1, 42);

      expect(service.blockUser).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual({ message: 'User blocked successfully' });
    });
  });

  describe('unblockUser', () => {
    it('should delegate to service.unblockUser with blockerId and targetId', async () => {
      (service.unblockUser as jest.Mock<any>) = jest
        .fn()
        .mockResolvedValue({ message: 'User unblocked successfully' });

      const result = await controller.unblockUser(1, 42);

      expect(service.unblockUser).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual({ message: 'User unblocked successfully' });
    });
  });
});
