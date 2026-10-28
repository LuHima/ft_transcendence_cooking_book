import { Test, TestingModule } from '@nestjs/testing';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('FriendsController', () => {
  let controller: FriendsController;
  let service: FriendsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FriendsController],
      providers: [
        {
          provide: FriendsService,
          useValue: {
            getFriends: jest.fn(),
            removeFriend: jest.fn(),
            sendFriendRequest: jest.fn(),
            getFriendRequests: jest.fn(),
            acceptFriendRequest: jest.fn(),
            rejectFriendRequest: jest.fn(),
            cancelFriendRequest: jest.fn(),
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

    controller = module.get<FriendsController>(FriendsController);
    service = module.get<FriendsService>(FriendsService);
  });

  describe('getFriends', () => {
    it('should delegate to service.getFriends', async () => {
      const mockResponse = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getFriends as jest.Mock<any>).mockResolvedValue(mockResponse);

      const query = { page: 1, limit: 20, search: 'mario' };
      const result = await controller.getFriends(1, query);

      expect(result).toEqual(mockResponse);
      expect(service.getFriends).toHaveBeenCalledWith(1, query);
    });
  });

  describe('removeFriend', () => {
    it('should delegate to service.removeFriend', async () => {
      const mockResponse = { message: 'Friend removed successfully' };
      (service.removeFriend as jest.Mock<any>).mockResolvedValue(mockResponse);

      const result = await controller.removeFriend(1, 2);

      expect(result).toEqual(mockResponse);
      expect(service.removeFriend).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('sendFriendRequest', () => {
    it('should delegate to service.sendFriendRequest', async () => {
      const mockResponse = { message: 'Friend request sent', status: 'pending' };
      (service.sendFriendRequest as jest.Mock<any>).mockResolvedValue(mockResponse);

      const result = await controller.sendFriendRequest(1, { recipient_id: 2 });

      expect(result).toEqual(mockResponse);
      expect(service.sendFriendRequest).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('getFriendRequests', () => {
    it('should delegate to service.getFriendRequests', async () => {
      const mockResponse = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      (service.getFriendRequests as jest.Mock<any>).mockResolvedValue(mockResponse);

      const query = { type: 'incoming' as const, page: 1, limit: 20 };
      const result = await controller.getFriendRequests(1, query);

      expect(result).toEqual(mockResponse);
      expect(service.getFriendRequests).toHaveBeenCalledWith(1, query);
    });
  });

  describe('acceptFriendRequest', () => {
    it('should delegate to service.acceptFriendRequest', async () => {
      const mockResponse = { message: 'Friend request accepted' };
      (service.acceptFriendRequest as jest.Mock<any>).mockResolvedValue(mockResponse);

      const result = await controller.acceptFriendRequest(1, 2);

      expect(result).toEqual(mockResponse);
      expect(service.acceptFriendRequest).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('rejectFriendRequest', () => {
    it('should delegate to service.rejectFriendRequest', async () => {
      const mockResponse = { message: 'Friend request rejected' };
      (service.rejectFriendRequest as jest.Mock<any>).mockResolvedValue(mockResponse);

      const result = await controller.rejectFriendRequest(1, 2);

      expect(result).toEqual(mockResponse);
      expect(service.rejectFriendRequest).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('cancelFriendRequest', () => {
    it('should delegate to service.cancelFriendRequest', async () => {
      const mockResponse = { message: 'Friend request cancelled' };
      (service.cancelFriendRequest as jest.Mock<any>).mockResolvedValue(mockResponse);

      const result = await controller.cancelFriendRequest(1, 2);

      expect(result).toEqual(mockResponse);
      expect(service.cancelFriendRequest).toHaveBeenCalledWith(1, 2);
    });
  });
});
