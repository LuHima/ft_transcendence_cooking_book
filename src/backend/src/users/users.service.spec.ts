import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockDbUser = {
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
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            like: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            recipe: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getMe', () => {
    it('should return the full user profile if user exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockDbUser);

      const result = await service.getMe(1);

      expect(result).toEqual(mockDbUser);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatar_url: true,
          first_name: true,
          last_name: true,
          birth_date: true,
          phone: true,
          address: true,
          city: true,
          postal_code: true,
          created_at: true,
        },
      });
    });

    it('should throw NotFoundException if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getMe(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('should update user fields and return the updated user profile', async () => {
      const updateData = {
        first_name: 'Luigi',
        last_name: 'Verdi',
        city: 'Milano',
        phone: '+39987654321',
      };
      const expectedUpdatedUser = { ...mockDbUser, ...updateData };

      (prisma.user.update as jest.Mock).mockResolvedValue(expectedUpdatedUser);

      const result = await service.updateMe(1, updateData);

      expect(result).toEqual(expectedUpdatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining(updateData),
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatar_url: true,
          first_name: true,
          last_name: true,
          birth_date: true,
          phone: true,
          address: true,
          city: true,
          postal_code: true,
          created_at: true,
        },
      });
    });

    it('should throw NotFoundException if user is not found during update (Prisma P2025)', async () => {
      const p2025Error = new Error('Record to update not found');
      (p2025Error as any).code = 'P2025';
      (prisma.user.update as jest.Mock).mockRejectedValue(p2025Error);

      await expect(
        service.updateMe(999, { first_name: 'Luigi' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should rethrow unexpected database errors to let them bubble up to global filter', async () => {
      const unexpectedError = new Error('Connection terminated unexpectedly');
      (prisma.user.update as jest.Mock).mockRejectedValue(unexpectedError);

      await expect(
        service.updateMe(1, { first_name: 'Luigi' }),
      ).rejects.toThrow('Connection terminated unexpectedly');
    });

    it('should convert birth_date string to Date object and empty string to null', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue(mockDbUser);

      await service.updateMe(1, { birth_date: '1995-05-15' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ birth_date: new Date('1995-05-15') }),
        }),
      );

      await service.updateMe(1, { birth_date: '' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ birth_date: null }),
        }),
      );
    });

    it('should normalize email by trimming and lowercasing', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue(mockDbUser);

      await service.updateMe(1, { email: '  Mario.Rossi@Example.COM  ' });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'mario.rossi@example.com' }),
        }),
      );
    });

    it('should throw BadRequestException if birth_date has an invalid format', async () => {
      await expect(
        service.updateMe(1, { birth_date: 'not-a-valid-date' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if username or email already exists', async () => {
      const p2002Error = new Error('Unique constraint failed');
      (p2002Error as any).code = 'P2002';
      (prisma.user.update as jest.Mock).mockRejectedValue(p2002Error);

      await expect(
        service.updateMe(1, { email: 'already_taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateAvatar', () => {
    const mockFile = {
      filename: 'avatar-12345.png',
      originalname: 'test.png',
      path: '/uploads/avatars/avatar-12345.png',
    } as Express.Multer.File;

    it('should update avatar and return avatar_url', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        avatar_url: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 1,
        avatar_url: '/uploads/avatars/avatar-12345.png',
      });

      const result = await service.updateAvatar(1, mockFile);

      expect(result).toEqual({
        avatar_url: '/uploads/avatars/avatar-12345.png',
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { avatar_url: '/uploads/avatars/avatar-12345.png' },
      });
    });

    it('should throw NotFoundException if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updateAvatar(999, mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException without unlinking if file is undefined', async () => {
      await expect(
        service.updateAvatar(1, undefined as unknown as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteAvatar', () => {
    it('should set avatar_url to null and return success message', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        avatar_url: '/uploads/avatars/old-avatar.png',
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 1,
        avatar_url: null,
      });

      const result = await service.deleteAvatar(1);

      expect(result).toEqual({ message: 'Avatar deleted successfully' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { avatar_url: null },
      });
    });

    it('should throw NotFoundException if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteAvatar(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findUser', () => {
    it('returns matching usernames via case-insensitive contains', async () => {
      const mockUsers = [{ username: 'mario' }, { username: 'mario_chef' }];
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await service.findUser('mario');

      expect(result).toEqual(mockUsers);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          username: {
            contains: 'mario',
            mode: 'insensitive',
          },
        },
        select: {
          username: true,
        },
      });
    });
  });

  describe('getLikedRecipes', () => {
    const mockLikes = [
      {
        user_id: 1,
        recipe_id: 10,
        created_at: new Date('2026-09-10'),
        recipe: {
          id: 10,
          source_lang: 'it',
          course: 'first_course',
          difficulty: 'medium',
          prep_time: 15,
          cook_time: 10,
          total_time: 25,
          servings: 4,
          translation_status: 'completed',
          cover_image_url: '/uploads/recipes/cover.webp',
          video_url: null,
          created_at: new Date('2026-09-10'),
          updated_at: null,
          translations: [
            { locale: 'it', title: 'Carbonara', description: 'Classica' },
            {
              locale: 'en',
              title: 'Carbonara English',
              description: 'Classic',
            },
          ],
          user: { id: 2, username: 'chef_mario', avatar_url: null },
          recipe_tags: [],
          _count: { likes: 5, comments: 2 },
        },
      },
    ];

    it('should return paginated envelope with card items and pagination metadata', async () => {
      (prisma.like.findMany as jest.Mock).mockResolvedValue(mockLikes);
      (prisma.like.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getLikedRecipes(1, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(10);
      expect(result.items[0].title).toBe('Carbonara');
      expect(result.items[0].is_liked).toBe(true);
      expect(result.items[0].resolved_lang).toBe('it');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total_pages).toBe(1);
      expect(result.has_next_page).toBe(false);
      expect(result.has_prev_page).toBe(false);
    });

    it('should return liked recipes localized in requested language with pagination', async () => {
      (prisma.like.findMany as jest.Mock).mockResolvedValue(mockLikes);
      (prisma.like.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getLikedRecipes(1, {
        page: 1,
        limit: 10,
        lang: 'en',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(10);
      expect(result.items[0].title).toBe('Carbonara English');
      expect(result.items[0].description).toBe('Classic');
      expect(result.items[0].resolved_lang).toBe('en');
    });
  });

  describe('getMyRecipes', () => {
    const mockRecipes = [
      {
        id: 101,
        user_id: 1,
        source_lang: 'it',
        course: 'dessert',
        difficulty: 'easy',
        prep_time: 20,
        cook_time: 0,
        total_time: 20,
        servings: 6,
        translation_status: 'completed',
        cover_image_url: null,
        video_url: null,
        created_at: new Date('2026-09-01'),
        updated_at: null,
        translations: [
          { locale: 'it', title: 'Tiramisù', description: 'Dolce classico' },
          { locale: 'en', title: 'Tiramisu', description: 'Classic dessert' },
        ],
        user: { id: 1, username: 'mario', avatar_url: null },
        recipe_tags: [],
        likes: [{ user_id: 1 }],
        _count: { likes: 12, comments: 4 },
      },
    ];

    it('should return paginated authored recipes with card projection', async () => {
      (prisma.recipe.findMany as jest.Mock).mockResolvedValue(mockRecipes);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getMyRecipes(1, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(101);
      expect(result.items[0].title).toBe('Tiramisù');
      expect(result.items[0].is_liked).toBe(true);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 1 },
          skip: 0,
          take: 20,
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('should project localized title and description when lang is provided', async () => {
      (prisma.recipe.findMany as jest.Mock).mockResolvedValue(mockRecipes);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getMyRecipes(1, {
        page: 1,
        limit: 20,
        lang: 'en',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe(101);
      expect(result.items[0].title).toBe('Tiramisu');
      expect(result.items[0].description).toBe('Classic dessert');
      expect(result.items[0].resolved_lang).toBe('en');
    });
  });

  describe('getUser', () => {
    it('should return only public user profile fields and exclude password_hash and PII', async () => {
      const publicUser = {
        id: 1,
        username: 'mario',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: new Date('2026-09-01T10:00:00Z'),
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(publicUser);

      const result = await service.getUser(1);

      expect(result).toEqual(publicUser);
      expect(result).not.toHaveProperty('password_hash');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('phone');
      expect(result).not.toHaveProperty('address');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: {
          id: true,
          username: true,
          avatar_url: true,
          created_at: true,
        },
      });
    });

    it('should throw NotFoundException if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getUser(999)).rejects.toThrow(NotFoundException);
    });
  });
});
