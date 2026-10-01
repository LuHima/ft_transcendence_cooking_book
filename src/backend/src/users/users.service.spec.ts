import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

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
      (prisma.user.update as jest.Mock).mockRejectedValue(new Error('Record not found'));

      await expect(service.updateMe(999, { first_name: 'Luigi' })).rejects.toThrow(NotFoundException);
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

    it('should throw ConflictException if username or email already exists', async () => {
      const p2002Error = new Error('Unique constraint failed');
      (p2002Error as any).code = 'P2002';
      (prisma.user.update as jest.Mock).mockRejectedValue(p2002Error);

      await expect(service.updateMe(1, { email: 'already_taken@example.com' })).rejects.toThrow(
        ConflictException,
      );
    });
  });
});

