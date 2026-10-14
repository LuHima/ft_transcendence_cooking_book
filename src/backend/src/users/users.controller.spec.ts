import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

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
            getMe: jest.fn<() => Promise<any>>().mockResolvedValue(mockUser),
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
        .fn<() => Promise<any>>()
        .mockResolvedValue(updatedUser);

      const result = await controller.updateMe(1, updateDto as any);

      expect(result).toEqual(updatedUser);
      expect(service.updateMe).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('updateAvatar', () => {
    it('should upload avatar and return avatar_url', async () => {
      const mockFile = { filename: 'avatar-123.jpg' } as Express.Multer.File;
      const mockResponse = { avatar_url: '/uploads/avatars/avatar-123.jpg' };
      (service.updateAvatar as jest.Mock<any>) = jest
        .fn<() => Promise<any>>()
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
        .fn<() => Promise<any>>()
        .mockResolvedValue(mockResponse);

      const result = await controller.deleteAvatar(1);

      expect(result).toEqual(mockResponse);
      expect(service.deleteAvatar).toHaveBeenCalledWith(1);
    });
  });

  describe('getLikedRecipes', () => {
    it('should return liked recipes for the authenticated user', async () => {
      const mockRecipes = [{ id: 10, title: 'Carbonara' }];
      (service.getLikedRecipes as jest.Mock<any>) = jest
        .fn<() => Promise<any>>()
        .mockResolvedValue(mockRecipes);

      const result = await controller.getLikedRecipes(1, 'it');

      expect(result).toEqual(mockRecipes);
      expect(service.getLikedRecipes).toHaveBeenCalledWith(1, 'it');
    });
  });

  describe('getUser', () => {
    it('should delegate to service.getUser with user id', async () => {
      const publicUser = {
        id: 1,
        username: 'mario',
        avatar_url: 'https://example.com/avatar.jpg',
        created_at: new Date('2026-09-01T10:00:00Z'),
      };
      (service.getUser as jest.Mock<any>) = jest
        .fn<() => Promise<any>>()
        .mockResolvedValue(publicUser);

      const result = await controller.getUser(1);

      expect(result).toEqual(publicUser);
      expect(service.getUser).toHaveBeenCalledWith(1);
    });
  });
});
