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
    bio: 'Passionate Italian chef and home cook.',
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
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            like: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            recipe: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
            friendship: {
              findFirst: jest.fn(),
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
          bio: true,
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
        city: 'Milano',
        email: ' LUIGI@EXAMPLE.COM ',
      };
      const updatedUser = {
        ...mockDbUser,
        first_name: 'Luigi',
        city: 'Milano',
        email: 'luigi@example.com',
      };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateMe(1, updateData);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          first_name: 'Luigi',
          city: 'Milano',
          email: 'luigi@example.com',
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatar_url: true,
          bio: true,
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

    it('should parse valid ISO birth_date string into Date object', async () => {
      const updateData = { birth_date: '1995-05-20' };
      (prisma.user.update as jest.Mock).mockResolvedValue(mockDbUser);

      await service.updateMe(1, updateData);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            birth_date: new Date('1995-05-20'),
          }),
        }),
      );
    });

    it('should set birth_date to null when passed empty string', async () => {
      const updateData = { birth_date: '' };
      (prisma.user.update as jest.Mock).mockResolvedValue(mockDbUser);

      await service.updateMe(1, updateData);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            birth_date: null,
          }),
        }),
      );
    });

    it('should throw BadRequestException when invalid birth_date is passed', async () => {
      const updateData = { birth_date: 'not-a-valid-date' };

      await expect(service.updateMe(1, updateData)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update bio when bio is provided', async () => {
      const updateData = { bio: 'New bio content for cook' };
      const updatedUser = { ...mockDbUser, bio: 'New bio content for cook' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateMe(1, updateData);

      expect(result.bio).toBe('New bio content for cook');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bio: 'New bio content for cook',
          }),
        }),
      );
    });

    it('should throw ConflictException on Prisma unique violation (P2002)', async () => {
      const updateData = { username: 'already_taken' };
      (prisma.user.update as jest.Mock).mockRejectedValue({ code: 'P2002' });

      await expect(service.updateMe(1, updateData)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw NotFoundException on Prisma record not found (P2025)', async () => {
      const updateData = { first_name: 'Luigi' };
      (prisma.user.update as jest.Mock).mockRejectedValue({ code: 'P2025' });

      await expect(service.updateMe(999, updateData)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAvatar', () => {
    it('should throw BadRequestException if file is missing', async () => {
      await expect(service.updateAvatar(1, null as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      const mockFile = { filename: 'avatar.jpg' } as Express.Multer.File;

      await expect(service.updateAvatar(999, mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update user avatar_url and return the relative path', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        avatar_url: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: 1,
        avatar_url: '/uploads/avatars/avatar-123.jpg',
      });
      const mockFile = { filename: 'avatar-123.jpg' } as Express.Multer.File;

      const result = await service.updateAvatar(1, mockFile);

      expect(result).toEqual({ avatar_url: '/uploads/avatars/avatar-123.jpg' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { avatar_url: '/uploads/avatars/avatar-123.jpg' },
      });
    });
  });

  describe('deleteAvatar', () => {
    it('should throw NotFoundException if user is not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteAvatar(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should set avatar_url to null and return success message', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        avatar_url: '/uploads/avatars/avatar-123.jpg',
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

  describe('findUsers', () => {
    const mockUsers = [
      {
        id: 2,
        username: 'giulia_chef',
        avatar_url: '/uploads/avatars/giulia.webp',
        first_name: 'Giulia',
        last_name: 'Bianchi',
        created_at: new Date('2026-09-01T10:00:00Z'),
        _count: { recipes: 5 },
      },
      {
        id: 3,
        username: 'luca_cook',
        avatar_url: null,
        first_name: 'Luca',
        last_name: 'Verdi',
        created_at: new Date('2026-09-05T10:00:00Z'),
        _count: { recipes: 2 },
      },
      {
        id: 4,
        username: 'paolo_baker',
        avatar_url: null,
        first_name: 'Paolo',
        last_name: 'Neri',
        created_at: new Date('2026-09-10T10:00:00Z'),
        _count: { recipes: 1 },
      },
      {
        id: 5,
        username: 'sara_chef',
        avatar_url: null,
        first_name: 'Sara',
        last_name: 'Gialli',
        created_at: new Date('2026-09-15T10:00:00Z'),
        _count: { recipes: 0 },
      },
    ];

    it('returns top authors sorted by recipes_count_desc when search is omitted (guest caller)', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(4);

      const result = await service.findUsers({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(4);
      expect(result.items[0]).toEqual({
        id: 2,
        username: 'giulia_chef',
        avatar_url: '/uploads/avatars/giulia.webp',
        first_name: 'Giulia',
        last_name: 'Bianchi',
        created_at: new Date('2026-09-01T10:00:00Z'),
        recipes_count: 5,
        friendship_status: null,
      });
      expect(result.total).toBe(4);
      expect(result.total_pages).toBe(1);
      expect(result.has_next_page).toBe(false);
      expect(result.has_prev_page).toBe(false);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          deleted_at: null,
        },
        skip: 0,
        take: 20,
        orderBy: [{ recipes: { _count: 'desc' } }, { username: 'asc' }],
        select: {
          id: true,
          username: true,
          avatar_url: true,
          first_name: true,
          last_name: true,
          created_at: true,
          _count: {
            select: {
              recipes: true,
            },
          },
        },
      });
      expect(prisma.friendship.findMany).not.toHaveBeenCalled();
    });

    it('searches by username, first_name, or last_name and defaults to username_asc', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUsers[0]]);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findUsers({ search: 'giulia' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].username).toBe('giulia_chef');
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'active',
            deleted_at: null,
            OR: [
              { username: { contains: 'giulia', mode: 'insensitive' } },
              { first_name: { contains: 'giulia', mode: 'insensitive' } },
              { last_name: { contains: 'giulia', mode: 'insensitive' } },
            ],
          },
          orderBy: [{ username: 'asc' }],
        }),
      );
    });

    it('treats whitespace-only search string as omitted search', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(4);

      await service.findUsers({ search: '   ' });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'active',
            deleted_at: null,
          },
          orderBy: [{ recipes: { _count: 'desc' } }, { username: 'asc' }],
        }),
      );
    });

    it.each([
      ['username_asc' as const, [{ username: 'asc' }]],
      ['username_desc' as const, [{ username: 'desc' }]],
      [
        'recipes_count_desc' as const,
        [{ recipes: { _count: 'desc' } }, { username: 'asc' }],
      ],
      ['newest' as const, [{ created_at: 'desc' }, { id: 'desc' }]],
      ['oldest' as const, [{ created_at: 'asc' }, { id: 'asc' }]],
    ])(
      'resolves orderBy correctly for sort %s',
      async (sortValue, expectedOrderBy) => {
        (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
        (prisma.user.count as jest.Mock).mockResolvedValue(0);

        await service.findUsers({ sort: sortValue });

        expect(prisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: expectedOrderBy,
          }),
        );
      },
    );

    it('resolves contextual friendship status and excludes caller for authenticated user', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(4);
      (prisma.friendship.findMany as jest.Mock).mockResolvedValue([
        { requester_id: 1, addressee_id: 2, status: 'accepted' },
        { requester_id: 1, addressee_id: 3, status: 'pending' },
        { requester_id: 4, addressee_id: 1, status: 'pending' },
      ]);

      const result = await service.findUsers({ page: 1, limit: 20 }, 1);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: 1 },
            status: 'active',
            deleted_at: null,
          }),
        }),
      );

      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { requester_id: 1, addressee_id: { in: [2, 3, 4, 5] } },
            { requester_id: { in: [2, 3, 4, 5] }, addressee_id: 1 },
          ],
        },
      });

      expect(result.items[0].friendship_status).toBe('friends');
      expect(result.items[1].friendship_status).toBe('pending_sent');
      expect(result.items[2].friendship_status).toBe('pending_received');
      expect(result.items[3].friendship_status).toBe('none');
    });

    it('maps rejected friendship records to "none"', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([mockUsers[0]]);
      (prisma.user.count as jest.Mock).mockResolvedValue(1);
      (prisma.friendship.findMany as jest.Mock).mockResolvedValue([
        { requester_id: 1, addressee_id: 2, status: 'rejected' },
      ]);

      const result = await service.findUsers({ page: 1, limit: 20 }, 1);

      expect(result.items[0].friendship_status).toBe('none');
    });

    it('calculates pagination skip, take, and navigation flags correctly', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prisma.user.count as jest.Mock).mockResolvedValue(45);

      const result = await service.findUsers({ page: 2, limit: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(45);
      expect(result.total_pages).toBe(5);
      expect(result.has_next_page).toBe(true);
      expect(result.has_prev_page).toBe(true);
    });

    it('handles empty results and avoids friendship queries', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findUsers({ page: 1, limit: 20 }, 1);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.total_pages).toBe(0);
      expect(result.has_next_page).toBe(false);
      expect(result.has_prev_page).toBe(false);
      expect(prisma.friendship.findMany).not.toHaveBeenCalled();
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
    const publicUserDb = {
      id: 2,
      username: 'giulia',
      first_name: 'Giulia',
      last_name: 'Bianchi',
      avatar_url: 'https://example.com/avatar.jpg',
      bio: 'Passionate Italian home cook specializing in pasta.',
      created_at: new Date('2026-09-01T10:00:00Z'),
    };

    it('should return enriched public profile with metrics and friendship_status: null for guest', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(publicUserDb);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(12);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(45);
      (prisma.like.count as jest.Mock).mockResolvedValue(138);

      const result = await service.getUser(2);

      expect(result).toEqual({
        id: 2,
        username: 'giulia',
        first_name: 'Giulia',
        last_name: 'Bianchi',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Passionate Italian home cook specializing in pasta.',
        created_at: new Date('2026-09-01T10:00:00Z'),
        recipes_count: 12,
        friends_count: 45,
        total_likes_received: 138,
        friendship_status: null,
      });

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 2,
          status: 'active',
          deleted_at: null,
        },
        select: {
          id: true,
          username: true,
          first_name: true,
          last_name: true,
          avatar_url: true,
          bio: true,
          created_at: true,
        },
      });
      expect(prisma.recipe.count).toHaveBeenCalledWith({
        where: { user_id: 2 },
      });
      expect(prisma.friendship.count).toHaveBeenCalledWith({
        where: {
          status: 'accepted',
          OR: [{ requester_id: 2 }, { addressee_id: 2 }],
        },
      });
      expect(prisma.like.count).toHaveBeenCalledWith({
        where: { recipe: { user_id: 2 } },
      });
    });

    it('should return friendship_status: null when viewing own profile', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(publicUserDb);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(0);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(0);
      (prisma.like.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getUser(2, 2);

      expect(result.friendship_status).toBeNull();
      expect(prisma.friendship.findFirst).not.toHaveBeenCalled();
    });

    it('should return friendship_status: "friends" when accepted friendship exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(publicUserDb);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(5);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(10);
      (prisma.like.count as jest.Mock).mockResolvedValue(20);
      (prisma.friendship.findFirst as jest.Mock).mockResolvedValue({
        id: 1,
        requester_id: 1,
        addressee_id: 2,
        status: 'accepted',
      });

      const result = await service.getUser(2, 1);

      expect(result.friendship_status).toBe('friends');
    });

    it('should return friendship_status: "pending_sent" when caller sent pending request', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(publicUserDb);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(0);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(0);
      (prisma.like.count as jest.Mock).mockResolvedValue(0);
      (prisma.friendship.findFirst as jest.Mock).mockResolvedValue({
        id: 1,
        requester_id: 1,
        addressee_id: 2,
        status: 'pending',
      });

      const result = await service.getUser(2, 1);

      expect(result.friendship_status).toBe('pending_sent');
    });

    it('should return friendship_status: "pending_received" when caller received pending request', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(publicUserDb);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(0);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(0);
      (prisma.like.count as jest.Mock).mockResolvedValue(0);
      (prisma.friendship.findFirst as jest.Mock).mockResolvedValue({
        id: 1,
        requester_id: 2,
        addressee_id: 1,
        status: 'pending',
      });

      const result = await service.getUser(2, 1);

      expect(result.friendship_status).toBe('pending_received');
    });

    it('should return friendship_status: "none" when no relation exists', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(publicUserDb);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(0);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(0);
      (prisma.like.count as jest.Mock).mockResolvedValue(0);
      (prisma.friendship.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getUser(2, 1);

      expect(result.friendship_status).toBe('none');
    });

    it('should throw NotFoundException if user is not found, banned, or soft-deleted', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getUser(999)).rejects.toThrow(NotFoundException);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 999,
          status: 'active',
          deleted_at: null,
        },
        select: expect.any(Object),
      });
    });
  });

  describe('getUserByUsername', () => {
    const publicUserDb = {
      id: 2,
      username: 'giulia_chef',
      first_name: 'Giulia',
      last_name: 'Bianchi',
      avatar_url: '/uploads/avatars/giulia.webp',
      bio: 'Culinary enthusiast',
      created_at: new Date('2026-09-01T10:00:00Z'),
    };

    it('should resolve user by case-insensitive handle and delegate to getUser', async () => {
      (prisma.user.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: 2 }) // lookup for getUserByUsername
        .mockResolvedValueOnce(publicUserDb); // lookup in getUser
      (prisma.recipe.count as jest.Mock).mockResolvedValue(3);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(7);
      (prisma.like.count as jest.Mock).mockResolvedValue(15);
      (prisma.friendship.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getUserByUsername('GIULIA_CHEF', 1);

      expect(prisma.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          username: { equals: 'GIULIA_CHEF', mode: 'insensitive' },
          status: 'active',
          deleted_at: null,
        },
        select: { id: true },
      });
      expect(result.id).toBe(2);
      expect(result.username).toBe('giulia_chef');
      expect(result.recipes_count).toBe(3);
      expect(result.friends_count).toBe(7);
      expect(result.total_likes_received).toBe(15);
      expect(result.friendship_status).toBe('none');
    });

    it('should throw NotFoundException if user with username does not exist or is inactive', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getUserByUsername('nonexistent_user'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: { equals: 'nonexistent_user', mode: 'insensitive' },
          status: 'active',
          deleted_at: null,
        },
        select: { id: true },
      });
    });
  });

  describe('getUserFriends', () => {
    it('should return paginated friends list for active target user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 2 });
      const mockFriends = [
        {
          id: 1,
          requester_id: 2,
          addressee_id: 1,
          updated_at: new Date('2026-10-01'),
          requester: { id: 2, username: 'giulia', avatar_url: null },
          addressee: { id: 1, username: 'mario', avatar_url: '/mario.png' },
        },
      ];
      (prisma.friendship.findMany as jest.Mock).mockResolvedValue(mockFriends);
      (prisma.friendship.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getUserFriends(2, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: 1,
        username: 'mario',
        avatar_url: '/mario.png',
        friends_since: new Date('2026-10-01'),
      });
      expect(result.total).toBe(1);
      expect(result.total_pages).toBe(1);
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 2, status: 'active', deleted_at: null },
        select: { id: true },
      });
    });

    it('should throw NotFoundException if target user does not exist or is inactive', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserFriends(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUserPublicRecipes', () => {
    const mockAuthorRecipes = [
      {
        id: 201,
        user_id: 2,
        source_lang: 'it',
        course: 'first_course',
        difficulty: 'medium',
        prep_time: 15,
        cook_time: 10,
        total_time: 25,
        servings: 4,
        translation_status: 'completed',
        cover_image_url: '/uploads/recipes/cover1.webp',
        video_url: null,
        created_at: new Date('2026-10-01T12:00:00Z'),
        updated_at: null,
        translations: [
          { locale: 'it', title: 'Amatriciana', description: 'Tradizionale' },
          {
            locale: 'en',
            title: 'Amatriciana Pasta',
            description: 'Traditional',
          },
        ],
        user: { id: 2, username: 'giulia', avatar_url: '/avatars/giulia.webp' },
        recipe_tags: [
          {
            tag: {
              id: 5,
              slug: 'pasta',
              translations: [{ locale: 'it', name: 'Pasta' }],
            },
          },
        ],
        likes: [{ user_id: 1 }],
        _count: { likes: 18, comments: 6 },
      },
      {
        id: 202,
        user_id: 2,
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
        created_at: new Date('2026-09-15T10:00:00Z'),
        updated_at: null,
        translations: [
          { locale: 'it', title: 'Panna Cotta', description: 'Delicata' },
        ],
        user: { id: 2, username: 'giulia', avatar_url: '/avatars/giulia.webp' },
        recipe_tags: [],
        likes: [],
        _count: { likes: 7, comments: 1 },
      },
    ];

    it('should return paginated recipes ordered chronologically with accurate is_liked for authenticated viewer', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 2 });
      (prisma.recipe.findMany as jest.Mock).mockResolvedValue(
        mockAuthorRecipes,
      );
      (prisma.recipe.count as jest.Mock).mockResolvedValue(2);

      const result = await service.getUserPublicRecipes(
        2,
        { page: 1, limit: 10 },
        1,
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 2, status: 'active', deleted_at: null },
        select: { id: true },
      });
      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user_id: 2 },
          skip: 0,
          take: 10,
          orderBy: { created_at: 'desc' },
          include: expect.objectContaining({
            likes: {
              where: { user_id: 1 },
              select: { user_id: true },
            },
          }),
        }),
      );
      expect(result.items).toHaveLength(2);
      expect(result.items[0].id).toBe(201);
      expect(result.items[0].title).toBe('Amatriciana');
      expect(result.items[0].is_liked).toBe(true);
      expect(result.items[0].tags[0]).toEqual({
        id: 5,
        slug: 'pasta',
        name: 'Pasta',
        resolved_lang: 'it',
      });
      expect(result.items[1].id).toBe(202);
      expect(result.items[1].is_liked).toBe(false);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.total_pages).toBe(1);
    });

    it('should set is_liked to false for unauthenticated viewer and not query likes', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 2 });
      (prisma.recipe.findMany as jest.Mock).mockResolvedValue([
        mockAuthorRecipes[0],
      ]);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getUserPublicRecipes(
        2,
        { page: 1, limit: 20 },
        undefined,
      );

      expect(result.items[0].is_liked).toBe(false);
    });

    it('should project requested language localization when lang parameter is provided', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 2 });
      (prisma.recipe.findMany as jest.Mock).mockResolvedValue([
        mockAuthorRecipes[0],
      ]);
      (prisma.recipe.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getUserPublicRecipes(
        2,
        { page: 1, limit: 20, lang: 'en' },
        1,
      );

      expect(result.items[0].title).toBe('Amatriciana Pasta');
      expect(result.items[0].description).toBe('Traditional');
      expect(result.items[0].resolved_lang).toBe('en');
    });

    it('should throw NotFoundException if target author does not exist or is inactive/banned/deleted', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getUserPublicRecipes(999, { page: 1, limit: 20 }, 1),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.recipe.findMany).not.toHaveBeenCalled();
    });
  });
});
