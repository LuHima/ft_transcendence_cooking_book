import { Test, TestingModule } from '@nestjs/testing';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';

describe('MediaController', () => {
  let controller: MediaController;
  let service: MediaService;

  const mockMediaService = {
    getRecipeMedia: jest.fn(),
    getAvatarMedia: jest.fn(),
  };

  const mockUser: ActiveUserData = {
    id: 1,
    username: 'mario',
    role: Role.user,
    session: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        {
          provide: MediaService,
          useValue: mockMediaService,
        },
      ],
    })
      .overrideGuard(OptionalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MediaController>(MediaController);
    service = module.get<MediaService>(MediaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRecipeMedia', () => {
    it('delegates to service.getRecipeMedia with isHeadRequest = false', async () => {
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      await controller.getRecipeMedia(
        42,
        'cover.webp',
        mockUser,
        mockReq,
        mockRes,
      );

      expect(service.getRecipeMedia).toHaveBeenCalledWith(
        42,
        'cover.webp',
        mockUser,
        mockReq,
        mockRes,
        false,
      );
    });
  });

  describe('headRecipeMedia', () => {
    it('delegates to service.getRecipeMedia with isHeadRequest = true', async () => {
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      await controller.headRecipeMedia(
        42,
        'cover.webp',
        mockUser,
        mockReq,
        mockRes,
      );

      expect(service.getRecipeMedia).toHaveBeenCalledWith(
        42,
        'cover.webp',
        mockUser,
        mockReq,
        mockRes,
        true,
      );
    });
  });

  describe('getAvatarMedia', () => {
    it('delegates to service.getAvatarMedia with isHeadRequest = false', async () => {
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      await controller.getAvatarMedia(
        7,
        'avatar.webp',
        mockUser,
        mockReq,
        mockRes,
      );

      expect(service.getAvatarMedia).toHaveBeenCalledWith(
        7,
        'avatar.webp',
        mockUser,
        mockReq,
        mockRes,
        false,
      );
    });
  });

  describe('headAvatarMedia', () => {
    it('delegates to service.getAvatarMedia with isHeadRequest = true', async () => {
      const mockReq = {} as Request;
      const mockRes = {} as Response;

      await controller.headAvatarMedia(
        7,
        'avatar.webp',
        mockUser,
        mockReq,
        mockRes,
      );

      expect(service.getAvatarMedia).toHaveBeenCalledWith(
        7,
        'avatar.webp',
        mockUser,
        mockReq,
        mockRes,
        true,
      );
    });
  });
});
