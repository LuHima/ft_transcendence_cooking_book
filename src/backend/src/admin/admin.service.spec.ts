import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { BanHistoryService } from '../reports/ban-history.service';
import { OwnerType, Role, UserStatus } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserSortBy, SortOrder } from '../users/dto/search-user-query.dto';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: PrismaService;
  let imageProcessingService: ImageProcessingService;
  let mockBanHistoryService: any;

  const mockAdminUser = {
    id: 1,
    username: 'superadmin',
    email: 'admin@wecook.com',
    role: Role.admin,
    status: UserStatus.active,
    password_hash: 'hashed_pw',
    avatar_url: '/uploads/avatars/admin.webp',
    bio: 'Lead admin',
    first_name: 'Super',
    last_name: 'Admin',
    birth_date: new Date('1985-01-01'),
    phone: '+39011111111',
    address: 'Via Admin 1',
    city: 'Rome',
    postal_code: '00100',
    created_at: new Date('2026-01-01'),
    deleted_at: null,
    _count: { recipes: 5 },
  };

  const mockTargetUser = {
    id: 2,
    username: 'chef_luigi',
    email: 'luigi@wecook.com',
    role: Role.user,
    status: UserStatus.active,
    password_hash: 'hashed_pw',
    avatar_url: '/uploads/avatars/luigi.webp',
    bio: 'Pasta master',
    first_name: 'Luigi',
    last_name: 'Verdi',
    birth_date: new Date('1992-05-10'),
    phone: '+39022222222',
    address: 'Via Pasta 12',
    city: 'Bologna',
    postal_code: '40100',
    created_at: new Date('2026-02-01'),
    deleted_at: null,
    _count: { recipes: 12 },
  };

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      recipe: {
        updateMany: jest.fn(),
      },
      comment: {
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      jwtSession: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(mockPrisma)),
    };

    const mockImageProcessing = {
      processAvatarFile: jest.fn().mockResolvedValue({
        filename: 'new-avatar.webp',
        relativePath: '/uploads/avatars/new-avatar.webp',
      }),
    };

    mockBanHistoryService = {
      recordBan: jest.fn().mockResolvedValue({ id: 'ban-1' }),
      recordUnban: jest.fn().mockResolvedValue({ id: 'ban-1' }),
      getPreviousBansCount: jest.fn().mockResolvedValue(0),
      getUserBanHistory: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ImageProcessingService, useValue: mockImageProcessing },
        { provide: BanHistoryService, useValue: mockBanHistoryService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = module.get<PrismaService>(PrismaService);
    imageProcessingService = module.get<ImageProcessingService>(
      ImageProcessingService,
    );
  });

  describe('getUsers', () => {
    it('returns paginated users sorted by newest by default when search is omitted', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        mockTargetUser,
        mockAdminUser,
      ]);
      (prisma.user.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getUsers({ page: 1, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 10,
        include: { _count: { select: { recipes: true, ban_history: true } } },
      });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0].username).toBe('chef_luigi');
      expect(result.items[0].recipes_count).toBe(12);
    });

    it('defaults to username_asc sort when search parameter is provided', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockTargetUser]);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      await service.getUsers({ search: 'luigi' });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { username: { contains: 'luigi', mode: 'insensitive' } },
            { first_name: { contains: 'luigi', mode: 'insensitive' } },
            { last_name: { contains: 'luigi', mode: 'insensitive' } },
            { email: { contains: 'luigi', mode: 'insensitive' } },
          ],
        },
        orderBy: [{ username: 'asc' }],
        skip: 0,
        take: 20,
        include: { _count: { select: { recipes: true, ban_history: true } } },
      });
    });

    it('filters by role and status including inactive and disabled members', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.getUsers({
        role: Role.moderator,
        status: UserStatus.disabled,
      });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: Role.moderator,
          status: UserStatus.disabled,
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 20,
        include: { _count: { select: { recipes: true, ban_history: true } } },
      });
    });

    it('applies contextual defaults for search vs omitted search', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      // Search omitted: default to created_at desc
      await service.getUsers({});
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        }),
      );

      // Search provided: default to username asc
      await service.getUsers({ search: 'mario' });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ username: 'asc' }],
        }),
      );
    });

    it('applies contextual default sort_order when sort_by is provided without sort_order', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.getUsers({ sort_by: UserSortBy.created_at });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        }),
      );

      await service.getUsers({ sort_by: UserSortBy.username });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ username: 'asc' }],
        }),
      );

      await service.getUsers({ sort_by: UserSortBy.recipes_count });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ recipes: { _count: 'desc' } }, { username: 'asc' }],
        }),
      );
    });

    it('applies explicit sort criteria correctly', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      await service.getUsers({
        sort_by: UserSortBy.recipes_count,
        sort_order: SortOrder.desc,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ recipes: { _count: 'desc' } }, { username: 'asc' }],
        }),
      );

      await service.getUsers({
        sort_by: UserSortBy.created_at,
        sort_order: SortOrder.asc,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
        }),
      );

      await service.getUsers({
        sort_by: UserSortBy.username,
        sort_order: SortOrder.desc,
      });
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ username: 'desc' }],
        }),
      );
    });
  });

  describe('getUserById', () => {
    it('returns administrative user details including previous_bans_count', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockTargetUser,
        _count: { recipes: 12, ban_history: 2 },
      });

      const result = await service.getUserById(2);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
        include: { _count: { select: { recipes: true, ban_history: true } } },
      });
      expect(result.id).toBe(2);
      expect(result.previous_bans_count).toBe(2);
    });

    it('throws HttpException with 404 when user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserById(999)).rejects.toThrow();
    });
  });

  describe('getUserBanHistory', () => {
    it('delegates lookup to banHistoryService when user exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 2 });
      const mockHistory = [
        {
          id: 'ban-1',
          user_id: 2,
          banned_by_id: 1,
          reason: 'spam_scam',
          duration_days: 7,
          is_permanent: false,
          banned_at: new Date(),
        },
      ];
      (mockBanHistoryService.getUserBanHistory as jest.Mock).mockResolvedValue(
        mockHistory,
      );

      const result = await service.getUserBanHistory(2);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 2 },
        select: { id: true },
      });
      expect(mockBanHistoryService.getUserBanHistory).toHaveBeenCalledWith(2);
      expect(result).toEqual(mockHistory);
    });

    it('throws HttpException with 404 when target user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserBanHistory(999)).rejects.toThrow();
    });
  });

  describe('createUser', () => {
    it('creates new user account with hashed password and returns admin representation', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({
        id: 10,
        username: 'new_mod',
        email: 'mod@wecook.com',
        role: Role.moderator,
        status: UserStatus.active,
        avatar_url: null,
        bio: 'Mod bio',
        first_name: 'Mod',
        last_name: 'User',
        birth_date: new Date('1995-03-20'),
        phone: null,
        address: null,
        city: null,
        postal_code: null,
        created_at: new Date('2026-03-01'),
        deleted_at: null,
        _count: { recipes: 0 },
      });

      const result = await service.createUser({
        username: 'new_mod',
        email: 'mod@wecook.com',
        password: 'Password123!',
        role: Role.moderator,
        bio: 'Mod bio',
        first_name: 'Mod',
        last_name: 'User',
        birth_date: '1995-03-20',
      });

      expect(result.id).toBe(10);
      expect(result.username).toBe('new_mod');
      expect(result.role).toBe(Role.moderator);
      expect(result.recipes_count).toBe(0);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            username: 'new_mod',
            email: 'mod@wecook.com',
            role: Role.moderator,
            status: UserStatus.active,
          }),
        }),
      );
    });

    it('throws 409 Conflict when username is already in use', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        username: 'new_mod',
        email: 'other@wecook.com',
      });

      await expect(
        service.createUser({
          username: 'new_mod',
          email: 'mod@wecook.com',
          password: 'Password123!',
          role: Role.user,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('throws 409 Conflict when email is already in use', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        username: 'other_user',
        email: 'mod@wecook.com',
      });

      await expect(
        service.createUser({
          username: 'new_mod',
          email: 'mod@wecook.com',
          password: 'Password123!',
          role: Role.user,
        }),
      ).rejects.toThrow(HttpException);
    });

    it('throws BadRequestException when birth_date format is invalid', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createUser({
          username: 'test_user',
          email: 'test@wecook.com',
          password: 'Password123!',
          role: Role.user,
          birth_date: 'invalid-date',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUser', () => {
    it('allows profile metadata updates without evicting active sessions', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockTargetUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockTargetUser,
        bio: 'Updated bio',
        first_name: 'Luigi Updated',
      });

      const result = await service.updateUser(
        2,
        { bio: 'Updated bio', first_name: 'Luigi Updated' },
        1,
      );

      expect(result.bio).toBe('Updated bio');
      expect(prisma.jwtSession.deleteMany).not.toHaveBeenCalled();
    });

    it('enforces anti-self-sabotage: rejects admin changing their own role', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      await expect(
        service.updateUser(1, { role: Role.user }, 1),
      ).rejects.toThrow(HttpException);
    });

    it('enforces anti-self-sabotage: rejects admin disabling their own account', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      await expect(
        service.updateUser(1, { status: UserStatus.disabled }, 1),
      ).rejects.toThrow(HttpException);
    });

    it('allows admin updating their own biographical profile details', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockAdminUser,
        bio: 'Updated admin bio',
      });

      const result = await service.updateUser(
        1,
        { bio: 'Updated admin bio' },
        1,
      );
      expect(result.bio).toBe('Updated admin bio');
    });

    it('enforces last-admin safeguard: rejects demoting the last active administrator', async () => {
      const secondAdmin = {
        id: 3,
        role: Role.admin,
        status: UserStatus.active,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(secondAdmin);
      (prisma.user.count as jest.Mock).mockResolvedValue(1); // Only 1 active admin exists

      await expect(
        service.updateUser(3, { role: Role.user }, 1),
      ).rejects.toThrow(HttpException);
    });

    it('enforces last-admin safeguard: rejects disabling the last active administrator', async () => {
      const secondAdmin = {
        id: 3,
        role: Role.admin,
        status: UserStatus.active,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(secondAdmin);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      await expect(
        service.updateUser(3, { status: UserStatus.disabled }, 1),
      ).rejects.toThrow(HttpException);
    });

    it('allows demoting an admin when another active administrator exists', async () => {
      const secondAdmin = {
        id: 3,
        role: Role.admin,
        status: UserStatus.active,
        _count: { recipes: 0 },
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(secondAdmin);
      (prisma.user.count as jest.Mock).mockResolvedValue(2); // 2 active admins
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...secondAdmin,
        role: Role.user,
      });

      const result = await service.updateUser(3, { role: Role.user }, 1);
      expect(result.role).toBe(Role.user);
      expect(prisma.jwtSession.deleteMany).toHaveBeenCalledWith({
        where: { id_user: 3 },
      });
    });

    it('purges active JWT sessions when password is reset', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockTargetUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockTargetUser);

      await service.updateUser(2, { password: 'NewPassword123!' }, 1);

      expect(prisma.jwtSession.deleteMany).toHaveBeenCalledWith({
        where: { id_user: 2 },
      });
    });

    it('triggers platform custody transfer and comment deactivation when status transitions to disabled', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockTargetUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockTargetUser,
        status: UserStatus.disabled,
        deleted_at: new Date(),
      });

      await service.updateUser(2, { status: UserStatus.disabled }, 1);

      expect(prisma.recipe.updateMany).toHaveBeenCalledWith({
        where: { user_id: 2 },
        data: { owner_type: OwnerType.platform },
      });
      expect(prisma.comment.updateMany).toHaveBeenCalledWith({
        where: { user_id: 2 },
        data: { is_active: false },
      });
      expect(prisma.jwtSession.deleteMany).toHaveBeenCalledWith({
        where: { id_user: 2 },
      });
    });

    it('atomically restores platform recipes and comments when reactivated from disabled to active', async () => {
      const disabledUser = {
        ...mockTargetUser,
        status: UserStatus.disabled,
        deleted_at: new Date('2026-02-15'),
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(disabledUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...disabledUser,
        status: UserStatus.active,
        deleted_at: null,
      });

      const result = await service.updateUser(
        2,
        { status: UserStatus.active },
        1,
      );

      expect(result.status).toBe(UserStatus.active);
      expect(result.deleted_at).toBeNull();
      expect(prisma.recipe.updateMany).toHaveBeenCalledWith({
        where: { user_id: 2, owner_type: OwnerType.platform },
        data: { owner_type: OwnerType.user },
      });
      expect(prisma.comment.updateMany).toHaveBeenCalledWith({
        where: { user_id: 2, is_active: false },
        data: { is_active: true },
      });
    });
  });

  describe('deleteUser', () => {
    it('enforces anti-self-sabotage: rejects administrator deleting own account', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockAdminUser);

      await expect(service.deleteUser(1, 1)).rejects.toThrow(HttpException);
    });

    it('enforces last-admin safeguard: rejects deleting the sole remaining administrator', async () => {
      const secondAdmin = {
        id: 3,
        role: Role.admin,
        status: UserStatus.active,
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(secondAdmin);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      await expect(service.deleteUser(3, 1)).rejects.toThrow(HttpException);
    });

    it('executes soft deletion: adopts public recipes to platform custody, deactivates comments, evicts sessions', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockTargetUser);

      const result = await service.deleteUser(2, 1, false);

      expect(result.message).toBe('User deactivated successfully');
      expect(prisma.jwtSession.deleteMany).toHaveBeenCalledWith({
        where: { id_user: 2 },
      });
      expect(prisma.recipe.updateMany).toHaveBeenCalledWith({
        where: { user_id: 2 },
        data: { owner_type: OwnerType.platform },
      });
      expect(prisma.comment.updateMany).toHaveBeenCalledWith({
        where: { user_id: 2 },
        data: { is_active: false },
      });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 2 },
          data: expect.objectContaining({
            status: UserStatus.disabled,
          }),
        }),
      );
    });

    it('executes hard deletion (?hard=true): disassociates recipes (user_id = null) and deletes user row', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockTargetUser);

      const result = await service.deleteUser(2, 1, true);

      expect(result.message).toBe('User permanently deleted');
      expect(prisma.recipe.updateMany).toHaveBeenCalledWith({
        where: { user_id: 2 },
        data: { owner_type: OwnerType.platform, user_id: null },
      });
      expect(prisma.comment.deleteMany).toHaveBeenCalledWith({
        where: { user_id: 2 },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 2 },
      });
    });
  });

  describe('Avatar management', () => {
    it('uploadUserAvatar processes image, unlinks previous avatar, and updates database', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockTargetUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockTargetUser,
        avatar_url: '/uploads/avatars/new-avatar.webp',
      });

      const mockFile = {
        filename: 'temp.png',
      } as Express.Multer.File;

      const result = await service.uploadUserAvatar(2, mockFile);

      expect(result).toEqual({
        avatar_url: '/uploads/avatars/new-avatar.webp',
      });
      expect(imageProcessingService.processAvatarFile).toHaveBeenCalledWith(
        mockFile,
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { avatar_url: '/uploads/avatars/new-avatar.webp' },
      });
    });

    it('deleteUserAvatar nullifies database reference and unlinks file', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockTargetUser);
      (prisma.user.update as jest.Mock).mockResolvedValue({
        ...mockTargetUser,
        avatar_url: null,
      });

      const result = await service.deleteUserAvatar(2);

      expect(result.message).toBe('Avatar deleted successfully');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 2 },
        data: { avatar_url: null },
      });
    });
  });
});
