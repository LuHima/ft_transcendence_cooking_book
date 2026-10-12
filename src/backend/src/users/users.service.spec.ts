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
              update: jest.fn(),
            },
            like: {
              findMany: jest.fn(),
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

    it('should throw NotFoundException if user is not found during update', async () => {
      (prisma.user.update as jest.Mock).mockRejectedValue(
        new Error('Record not found'),
      );

      await expect(
        service.updateMe(999, { first_name: 'Luigi' }),
      ).rejects.toThrow(NotFoundException);
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

  describe('getLikedRecipes', () => {
    const mockLikes = [
      {
        user_id: 1,
        recipe_id: 10,
        created_at: new Date('2026-09-10'),
        recipe: {
          id: 10,
          source_lang: 'it',
          translations: [
            { locale: 'it', title: 'Carbonara', description: 'Classica' },
            {
              locale: 'en',
              title: 'Carbonara English',
              description: 'Classic',
            },
          ],
          user: { id: 2, username: 'chef_mario', avatar_url: null },
        },
      },
    ];

    it('should return liked recipes with translations by default', async () => {
      (prisma.like.findMany as jest.Mock).mockResolvedValue(mockLikes);

      const result = await service.getLikedRecipes(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(10);
      expect(result[0].translations).toBeDefined();
    });

    it('should return liked recipes with localized title and description when lang is provided', async () => {
      (prisma.like.findMany as jest.Mock).mockResolvedValue(mockLikes);

      const result = await service.getLikedRecipes(1, 'en');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(10);
      expect((result[0] as any).title).toBe('Carbonara English');
      expect((result[0] as any).description).toBe('Classic');
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
