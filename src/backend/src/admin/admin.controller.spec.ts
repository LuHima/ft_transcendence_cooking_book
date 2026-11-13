import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Role, UserStatus } from '@prisma/client';
import { UserSortBy, SortOrder } from '../users/dto/search-user-query.dto';
import { JwtService } from '@nestjs/jwt';

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminUserResponse = {
    id: 1,
    username: 'superadmin',
    email: 'admin@wecook.com',
    role: Role.admin,
    status: UserStatus.active,
    avatar_url: '/uploads/avatars/admin.webp',
    bio: 'Lead admin',
    first_name: 'Super',
    last_name: 'Admin',
    birth_date: new Date('1985-01-01'),
    phone: '+39011111111',
    address: 'Via Admin 1',
    city: 'Rome',
    postal_code: '00100',
    recipes_count: 5,
    created_at: new Date('2026-01-01'),
    deleted_at: null,
  };

  beforeEach(async () => {
    const mockAdminService = {
      getUsers: jest.fn(),
      getUserById: jest.fn(),
      getUserBanHistory: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      uploadUserAvatar: jest.fn(),
      deleteUserAvatar: jest.fn(),
    };

    const mockJwtService = {
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('delegates to service.getUsers with query parameters', async () => {
      const mockResult = {
        items: [mockAdminUserResponse],
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getUsers as jest.Mock).mockResolvedValue(mockResult);

      const query = {
        page: 1,
        limit: 10,
        sort_by: UserSortBy.created_at,
        sort_order: SortOrder.desc,
      };
      const result = await controller.getUsers(query);

      expect(service.getUsers).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('createUser', () => {
    it('delegates to service.createUser with payload', async () => {
      (service.createUser as jest.Mock).mockResolvedValue(
        mockAdminUserResponse,
      );

      const dto = {
        username: 'superadmin',
        email: 'admin@wecook.com',
        password: 'Password123!',
        role: Role.admin,
      };
      const result = await controller.createUser(dto);

      expect(service.createUser).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockAdminUserResponse);
    });
  });

  describe('updateUser', () => {
    it('delegates to service.updateUser with ID, dto, and current admin ID', async () => {
      (service.updateUser as jest.Mock).mockResolvedValue(
        mockAdminUserResponse,
      );

      const dto = { bio: 'New bio' };
      const result = await controller.updateUser(2, dto, 1);

      expect(service.updateUser).toHaveBeenCalledWith(2, dto, 1);
      expect(result).toEqual(mockAdminUserResponse);
    });
  });

  describe('deleteUser', () => {
    it('delegates soft deletion to service.deleteUser by default', async () => {
      (service.deleteUser as jest.Mock).mockResolvedValue({
        message: 'User deactivated successfully',
      });

      const result = await controller.deleteUser(2, 1, undefined);

      expect(service.deleteUser).toHaveBeenCalledWith(2, 1, false);
      expect(result).toEqual({ message: 'User deactivated successfully' });
    });

    it('delegates hard deletion when hard=true', async () => {
      (service.deleteUser as jest.Mock).mockResolvedValue({
        message: 'User permanently deleted',
      });

      const result = await controller.deleteUser(2, 1, 'true');

      expect(service.deleteUser).toHaveBeenCalledWith(2, 1, true);
      expect(result).toEqual({ message: 'User permanently deleted' });
    });
  });

  describe('uploadUserAvatar', () => {
    it('delegates avatar upload to service.uploadUserAvatar', async () => {
      const mockResponse = { avatar_url: '/api/media/avatars/2/new.webp' };
      (service.uploadUserAvatar as jest.Mock).mockResolvedValue(mockResponse);

      const mockFile = { filename: 'avatar.webp' } as Express.Multer.File;
      const result = await controller.uploadUserAvatar(2, mockFile);

      expect(service.uploadUserAvatar).toHaveBeenCalledWith(2, mockFile);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('deleteUserAvatar', () => {
    it('delegates avatar deletion to service.deleteUserAvatar', async () => {
      const mockResponse = { message: 'Avatar deleted successfully' };
      (service.deleteUserAvatar as jest.Mock).mockResolvedValue(mockResponse);

      const result = await controller.deleteUserAvatar(2);

      expect(service.deleteUserAvatar).toHaveBeenCalledWith(2);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getUser', () => {
    it('delegates user retrieval to service.getUserById', async () => {
      (service.getUserById as jest.Mock).mockResolvedValue(
        mockAdminUserResponse,
      );

      const result = await controller.getUser(1);

      expect(service.getUserById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockAdminUserResponse);
    });
  });

  describe('getUserBanHistory', () => {
    it('delegates ban history lookup to service.getUserBanHistory', async () => {
      const mockBanHistory = [
        {
          id: 'ban-1',
          user_id: 1,
          banned_by_id: 2,
          reason: 'spam_scam',
          duration_days: 7,
          is_permanent: false,
          banned_at: new Date(),
        },
      ];
      (service.getUserBanHistory as jest.Mock).mockResolvedValue(
        mockBanHistory,
      );

      const result = await controller.getUserBanHistory(1);

      expect(service.getUserBanHistory).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockBanHistory);
    });
  });
});
