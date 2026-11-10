import { Test, TestingModule } from '@nestjs/testing';
import { MediaService } from './media.service';
import { MediaStreamingService } from './media-streaming.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { RecipePrivacy, Role } from '@prisma/client';
import {
  RECIPE_UPLOADS_DIR,
  AVATAR_UPLOADS_DIR,
} from '../common/config/upload-paths';
import { PassThrough } from 'stream';
import * as fs from 'fs';
import { join } from 'path';

describe('MediaService', () => {
  let service: MediaService;
  let streamingService: MediaStreamingService;

  const mockPrisma = {
    recipe: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    userBlock: {
      findFirst: jest.fn(),
    },
    friendship: {
      findFirst: jest.fn(),
    },
    report: {
      findFirst: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
    },
  };

  const mockStreamingService = {
    streamVideo: jest.fn(),
  };

  const testRecipeFile = join(RECIPE_UPLOADS_DIR, 'test_cover.webp');
  const testVideoFile = join(RECIPE_UPLOADS_DIR, 'test_tutorial.mp4');
  const testAvatarFile = join(AVATAR_UPLOADS_DIR, 'test_avatar.webp');

  beforeAll(() => {
    fs.mkdirSync(RECIPE_UPLOADS_DIR, { recursive: true });
    fs.mkdirSync(AVATAR_UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(testRecipeFile, Buffer.from('fake-image-bytes'));
    fs.writeFileSync(testVideoFile, Buffer.from('fake-video-bytes'));
    fs.writeFileSync(testAvatarFile, Buffer.from('fake-avatar-bytes'));
  });

  afterAll(() => {
    if (fs.existsSync(testRecipeFile)) fs.unlinkSync(testRecipeFile);
    if (fs.existsSync(testVideoFile)) fs.unlinkSync(testVideoFile);
    if (fs.existsSync(testAvatarFile)) fs.unlinkSync(testAvatarFile);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MediaStreamingService, useValue: mockStreamingService },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    streamingService = module.get<MediaStreamingService>(MediaStreamingService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRecipeMedia - Input Sanitization & Linkage', () => {
    it('throws BadRequestException on path traversal or invalid characters in filename', async () => {
      await expect(
        service.getRecipeMedia(1, '../../etc/passwd', undefined, {} as any, {} as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getRecipeMedia(1, 'recipe/sub/image.jpg', undefined, {} as any, {} as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getRecipeMedia(1, 'malicious.sh', undefined, {} as any, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getRecipeMedia(999, 'test_cover.webp', undefined, {} as any, {} as any),
      ).rejects.toThrow(new NotFoundException('Recipe not found'));
    });

    it('throws NotFoundException if media filename is not linked to recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 10,
        privacy: RecipePrivacy.public,
        cover_image_url: '/api/media/recipes/1/other_cover.webp',
        video_url: null,
        steps: [],
        recipe_media: [],
      });

      await expect(
        service.getRecipeMedia(1, 'test_cover.webp', undefined, {} as any, {} as any),
      ).rejects.toThrow(new NotFoundException('Media not found'));
    });
  });

  describe('getRecipeMedia - Mutual Block & Privacy Access Control', () => {
    const publicRecipe = {
      id: 1,
      user_id: 10,
      privacy: RecipePrivacy.public,
      cover_image_url: '/api/media/recipes/1/test_cover.webp',
      video_url: null,
      steps: [],
      recipe_media: [],
    };

    it('throws NotFoundException when caller and recipe author are mutually blocked', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(publicRecipe);
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce({ id: 1 });

      await expect(
        service.getRecipeMedia(
          1,
          'test_cover.webp',
          { id: 2, username: 'blocked_user', role: Role.user, session: 1 },
          {} as any,
          {} as any,
        ),
      ).rejects.toThrow(new NotFoundException('Recipe not found'));
    });

    it('allows guest access to public recipe media', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(publicRecipe);

      const mockRes: any = new PassThrough();
      mockRes.setHeader = jest.fn().mockReturnThis();
      mockRes.status = jest.fn().mockReturnThis();

      await service.getRecipeMedia(
        1,
        'test_cover.webp',
        undefined,
        {} as any,
        mockRes,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/webp',
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('friends_only recipe throws UnauthorizedException for unauthenticated guests', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.friends_only,
      });

      await expect(
        service.getRecipeMedia(1, 'test_cover.webp', undefined, {} as any, {} as any),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('friends_only recipe throws ForbiddenException for authenticated non-friends', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.friends_only,
      });
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce(null);
      mockPrisma.friendship.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getRecipeMedia(
          1,
          'test_cover.webp',
          { id: 5, username: 'stranger', role: Role.user, session: 1 },
          {} as any,
          {} as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('friends_only recipe allows confirmed friends', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.friends_only,
      });
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce(null);
      mockPrisma.friendship.findFirst.mockResolvedValueOnce({ id: 100, status: 'accepted' });

      const mockRes: any = new PassThrough();
      mockRes.setHeader = jest.fn().mockReturnThis();
      mockRes.status = jest.fn().mockReturnThis();

      await service.getRecipeMedia(
        1,
        'test_cover.webp',
        { id: 2, username: 'friend', role: Role.user, session: 1 },
        {} as any,
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('private recipe returns 404 for non-authors and guests', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.private,
      });

      await expect(
        service.getRecipeMedia(1, 'test_cover.webp', undefined, {} as any, {} as any),
      ).rejects.toThrow(new NotFoundException('Recipe not found'));

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.private,
      });
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getRecipeMedia(
          1,
          'test_cover.webp',
          { id: 3, username: 'other', role: Role.user, session: 1 },
          {} as any,
          {} as any,
        ),
      ).rejects.toThrow(new NotFoundException('Recipe not found'));
    });

    it('private recipe allows author access', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.private,
      });

      const mockRes: any = new PassThrough();
      mockRes.setHeader = jest.fn().mockReturnThis();
      mockRes.status = jest.fn().mockReturnThis();

      await service.getRecipeMedia(
        1,
        'test_cover.webp',
        { id: 10, username: 'author', role: Role.user, session: 1 },
        {} as any,
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('private recipe allows admin access and records audit log', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.private,
      });
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce(null);

      const logAuditSpy = jest.spyOn(service, 'logAudit');
      const mockRes: any = new PassThrough();
      mockRes.setHeader = jest.fn().mockReturnThis();
      mockRes.status = jest.fn().mockReturnThis();

      await service.getRecipeMedia(
        1,
        'test_cover.webp',
        { id: 99, username: 'admin', role: Role.admin, session: 1 },
        {} as any,
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(logAuditSpy).toHaveBeenCalledWith('ADMIN_PRIVATE_RECIPE_INSPECT', {
        userId: 99,
        recipeId: 1,
      });
    });

    it('private recipe allows moderator access with active pending report and logs audit', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.private,
      });
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce(null);
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.report.findFirst.mockResolvedValueOnce({ id: 55, status: 'pending' });

      const logAuditSpy = jest.spyOn(service, 'logAudit');
      const mockRes: any = new PassThrough();
      mockRes.setHeader = jest.fn().mockReturnThis();
      mockRes.status = jest.fn().mockReturnThis();

      await service.getRecipeMedia(
        1,
        'test_cover.webp',
        { id: 77, username: 'moderator', role: Role.moderator, session: 1 },
        {} as any,
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(logAuditSpy).toHaveBeenCalledWith(
        'MODERATOR_PRIVATE_RECIPE_CONTEXT_INSPECT',
        {
          userId: 77,
          recipeId: 1,
          reportId: 55,
        },
      );
    });

    it('private recipe throws 404 for moderator if no active report exists', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        ...publicRecipe,
        privacy: RecipePrivacy.private,
      });
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce(null);
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.report.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.getRecipeMedia(
          1,
          'test_cover.webp',
          { id: 77, username: 'moderator', role: Role.moderator, session: 1 },
          {} as any,
          {} as any,
        ),
      ).rejects.toThrow(new NotFoundException('Recipe not found'));
    });
  });

  describe('getRecipeMedia - Video Streaming & ETag Revalidation', () => {
    it('delegates video files to MediaStreamingService', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 10,
        privacy: RecipePrivacy.public,
        cover_image_url: null,
        video_url: '/api/media/recipes/1/test_tutorial.mp4',
        steps: [],
        recipe_media: [],
      });

      const mockReq = { headers: {} } as any;
      const mockRes = {
        setHeader: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await service.getRecipeMedia(
        1,
        'test_tutorial.mp4',
        undefined,
        mockReq,
        mockRes,
        false,
      );

      expect(streamingService.streamVideo).toHaveBeenCalledWith(
        testVideoFile,
        mockReq,
        mockRes,
        false,
      );
    });

    it('returns 304 Not Modified when ETag matches and user is authorized', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 10,
        privacy: RecipePrivacy.public,
        cover_image_url: '/api/media/recipes/1/test_cover.webp',
        video_url: null,
        steps: [],
        recipe_media: [],
      });

      const stat = fs.statSync(testRecipeFile);
      const computedEtag = `W/"${stat.size}-${stat.mtimeMs}"`;

      const mockReq = {
        headers: { 'if-none-match': computedEtag },
      } as any;
      const mockRes = {
        setHeader: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      } as any;

      await service.getRecipeMedia(
        1,
        'test_cover.webp',
        undefined,
        mockReq,
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(304);
      expect(mockRes.end).toHaveBeenCalled();
    });

    it('evaluates access control before ETag matching (immediate privacy revocation)', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 10,
        privacy: RecipePrivacy.friends_only,
        cover_image_url: '/api/media/recipes/1/test_cover.webp',
        video_url: null,
        steps: [],
        recipe_media: [],
      });
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce(null);
      // Unfriended!
      mockPrisma.friendship.findFirst.mockResolvedValueOnce(null);

      const stat = fs.statSync(testRecipeFile);
      const computedEtag = `W/"${stat.size}-${stat.mtimeMs}"`;

      const mockReq = {
        headers: { 'if-none-match': computedEtag },
      } as any;
      const mockRes = {
        setHeader: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as any;

      await expect(
        service.getRecipeMedia(
          1,
          'test_cover.webp',
          { id: 2, username: 'ex_friend', role: Role.user, session: 1 },
          mockReq,
          mockRes,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAvatarMedia', () => {
    it('throws BadRequestException for invalid avatar extension or path traversal', async () => {
      await expect(
        service.getAvatarMedia(1, 'video.mp4', undefined, {} as any, {} as any),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getAvatarMedia(1, '../avatar.png', undefined, {} as any, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getAvatarMedia(999, 'test_avatar.webp', undefined, {} as any, {} as any),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('throws NotFoundException if avatar is not linked to user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 7,
        avatar_url: '/api/media/avatars/7/different_avatar.webp',
      });

      await expect(
        service.getAvatarMedia(7, 'test_avatar.webp', undefined, {} as any, {} as any),
      ).rejects.toThrow(new NotFoundException('Avatar not found'));
    });

    it('allows guests to retrieve public avatar', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 7,
        avatar_url: '/api/media/avatars/7/test_avatar.webp',
      });

      const mockRes: any = new PassThrough();
      mockRes.setHeader = jest.fn().mockReturnThis();
      mockRes.status = jest.fn().mockReturnThis();

      await service.getAvatarMedia(
        7,
        'test_avatar.webp',
        undefined,
        {} as any,
        mockRes,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'image/webp',
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('throws NotFoundException if caller is blocked by user or has blocked user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 7,
        avatar_url: '/api/media/avatars/7/test_avatar.webp',
      });
      mockPrisma.userBlock.findFirst.mockResolvedValueOnce({ id: 1 });

      await expect(
        service.getAvatarMedia(
          7,
          'test_avatar.webp',
          { id: 2, username: 'blocked_caller', role: Role.user, session: 1 },
          {} as any,
          {} as any,
        ),
      ).rejects.toThrow(new NotFoundException('User not found'));
    });

    it('returns 304 Not Modified when ETag matches on avatar request', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 7,
        avatar_url: '/api/media/avatars/7/test_avatar.webp',
      });

      const stat = fs.statSync(testAvatarFile);
      const computedEtag = `W/"${stat.size}-${stat.mtimeMs}"`;

      const mockReq = {
        headers: { 'if-none-match': computedEtag },
      } as any;
      const mockRes = {
        setHeader: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      } as any;

      await service.getAvatarMedia(
        7,
        'test_avatar.webp',
        undefined,
        mockReq,
        mockRes,
      );

      expect(mockRes.status).toHaveBeenCalledWith(304);
      expect(mockRes.end).toHaveBeenCalled();
    });
  });
});
