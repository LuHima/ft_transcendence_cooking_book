import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageProcessingService } from '../common/services/image-processing.service';
import {
  AdminCommentSort,
  AdminCommentFormat,
  AdminCommentStatus,
} from './dto/admin-comment-query.dto';

describe('Admin Comments Subsystem (Tickets #95 & #96)', () => {
  let controller: AdminCommentsController;
  let service: AdminService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      comment: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      report: {
        groupBy: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCommentsController],
      providers: [
        AdminService,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: ImageProcessingService,
          useValue: {
            processAndSaveImage: jest.fn(),
            safeUnlink: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AdminCommentsController>(AdminCommentsController);
    service = module.get<AdminService>(AdminService);
  });

  describe('AdminCommentsController', () => {
    it('delegates findAllAdminComments to AdminService', async () => {
      const mockResult: any = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      jest
        .spyOn(service, 'findAllAdminComments')
        .mockResolvedValueOnce(mockResult);

      const query = { page: 1, limit: 20, sort: AdminCommentSort.newest };
      const result = await controller.findAllAdminComments(query);

      expect(service.findAllAdminComments).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });
  });

  describe('AdminService.findAllAdminComments (Flat Presentation & Filtering - #95)', () => {
    it('filters comments by is_edited=true', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({ is_edited: true });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_edited: true }),
        }),
      );
    });

    it('filters comments by active status', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({ status: AdminCommentStatus.active });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: true }),
        }),
      );
    });

    it('filters comments by inactive status', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({
        status: AdminCommentStatus.inactive,
      });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ is_active: false }),
        }),
      );
    });

    it('filters comments by search keyword, recipe_id, and user_id', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({
        search: 'tasty',
        recipe_id: 42,
        user_id: 10,
      });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content: { contains: 'tasty', mode: 'insensitive' },
            recipe_id: 42,
            user_id: 10,
          }),
        }),
      );
    });

    it('sorts by recipe: groups comments by recipe ID asc, then created_at desc', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({ sort: AdminCommentSort.recipe });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ recipe_id: 'asc' }, { created_at: 'desc' }],
        }),
      );
    });

    it('sorts by oldest: orders comments by created_at asc', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({ sort: AdminCommentSort.oldest });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'asc' },
        }),
      );
    });

    it('sorts by reports_desc: orders comments by highest report frequency descending', async () => {
      const commentA = {
        id: 1,
        recipe_id: 10,
        user_id: 100,
        content: 'Reported once',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-03-01'),
        user: { id: 100, username: 'user1', avatar_url: null },
        recipe: {
          id: 10,
          source_lang: 'it',
          translations: [{ locale: 'it', title: 'Pizza' }],
        },
      };
      const commentB = {
        id: 2,
        recipe_id: 10,
        user_id: 101,
        content: 'Reported 5 times',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-03-02'),
        user: { id: 101, username: 'user2', avatar_url: null },
        recipe: {
          id: 10,
          source_lang: 'it',
          translations: [{ locale: 'it', title: 'Pizza' }],
        },
      };
      const commentC = {
        id: 3,
        recipe_id: 11,
        user_id: 102,
        content: 'No reports',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-03-03'),
        user: { id: 102, username: 'user3', avatar_url: null },
        recipe: {
          id: 11,
          source_lang: 'it',
          translations: [{ locale: 'it', title: 'Pasta' }],
        },
      };

      mockPrisma.comment.findMany.mockResolvedValueOnce([
        commentA,
        commentB,
        commentC,
      ]);
      mockPrisma.report.groupBy.mockResolvedValueOnce([
        { target_id: 2, _count: { id: 5 } },
        { target_id: 1, _count: { id: 1 } },
      ]);

      const result = await service.findAllAdminComments({
        sort: AdminCommentSort.reports_desc,
      });

      expect(result.items).toHaveLength(3);
      // Comment B (5 reports) should be first
      expect(result.items[0].id).toBe(2);
      expect(result.items[0].reports_count).toBe(5);
      // Comment A (1 report) should be second
      expect(result.items[1].id).toBe(1);
      expect(result.items[1].reports_count).toBe(1);
      // Comment C (0 reports) should be third
      expect(result.items[2].id).toBe(3);
      expect(result.items[2].reports_count).toBe(0);
    });

    it('hydrates recipe title using requested locale with fallback to source_lang', async () => {
      const comment = {
        id: 1,
        recipe_id: 10,
        user_id: 100,
        content: 'Buono!',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-03-01'),
        user: { id: 100, username: 'user1', avatar_url: null },
        recipe: {
          id: 10,
          source_lang: 'it',
          translations: [
            { locale: 'it', title: 'Risotto ai Funghi' },
            { locale: 'en', title: 'Mushroom Risotto' },
          ],
        },
      };

      mockPrisma.comment.findMany.mockResolvedValueOnce([comment]);
      mockPrisma.comment.count.mockResolvedValueOnce(1);
      mockPrisma.report.groupBy.mockResolvedValueOnce([]);

      const resultEn = await service.findAllAdminComments({ lang: 'en' });
      expect(resultEn.items[0].recipe?.title).toBe('Mushroom Risotto');

      mockPrisma.comment.findMany.mockResolvedValueOnce([comment]);
      mockPrisma.comment.count.mockResolvedValueOnce(1);
      mockPrisma.report.groupBy.mockResolvedValueOnce([]);

      const resultFr = await service.findAllAdminComments({ lang: 'fr' });
      // Falls back to source_lang (it)
      expect(resultFr.items[0].recipe?.title).toBe('Risotto ai Funghi');
    });
  });

  describe('AdminService.findAllAdminComments (Threaded Presentation - #96)', () => {
    it('returns paginated root comments with nested windowed replies, reply counts, and has_more_replies', async () => {
      const root1 = {
        id: 10,
        recipe_id: 1,
        user_id: 1,
        parent_id: null,
        content: 'Root comment with 7 replies',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-01-01'),
        user: { id: 1, username: 'chef', avatar_url: null },
        recipe: {
          id: 1,
          source_lang: 'it',
          translations: [{ locale: 'it', title: 'Tiramisu' }],
        },
        replies: Array.from({ length: 7 }, (_, i) => ({
          id: 100 + i,
          recipe_id: 1,
          user_id: 2 + i,
          parent_id: 10,
          content: `Child reply ${i + 1}`,
          is_active: true,
          is_edited: false,
          created_at: new Date(`2026-01-0${i + 2}`),
          user: { id: 2 + i, username: `replyUser${i}`, avatar_url: null },
          recipe: {
            id: 1,
            source_lang: 'it',
            translations: [{ locale: 'it', title: 'Tiramisu' }],
          },
        })),
        _count: { replies: 7 },
      };

      const root2 = {
        id: 20,
        recipe_id: 1,
        user_id: 2,
        parent_id: null,
        content: 'Root comment with 2 replies',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-01-02'),
        user: { id: 2, username: 'cook', avatar_url: null },
        recipe: {
          id: 1,
          source_lang: 'it',
          translations: [{ locale: 'it', title: 'Tiramisu' }],
        },
        replies: [
          {
            id: 201,
            recipe_id: 1,
            user_id: 3,
            parent_id: 20,
            content: 'Reply 1',
            is_active: true,
            is_edited: false,
            created_at: new Date('2026-01-03'),
            user: { id: 3, username: 'alice', avatar_url: null },
            recipe: {
              id: 1,
              source_lang: 'it',
              translations: [{ locale: 'it', title: 'Tiramisu' }],
            },
          },
          {
            id: 202,
            recipe_id: 1,
            user_id: 4,
            parent_id: 20,
            content: 'Reply 2',
            is_active: true,
            is_edited: false,
            created_at: new Date('2026-01-04'),
            user: { id: 4, username: 'bob', avatar_url: null },
            recipe: {
              id: 1,
              source_lang: 'it',
              translations: [{ locale: 'it', title: 'Tiramisu' }],
            },
          },
        ],
        _count: { replies: 2 },
      };

      mockPrisma.comment.findMany.mockResolvedValueOnce([root1, root2]);
      mockPrisma.report.groupBy.mockResolvedValueOnce([]);

      const result = await service.findAllAdminComments({
        format: AdminCommentFormat.threaded,
        replies_limit: 5,
      });

      expect(result.items).toHaveLength(2);

      // Root 1 has 7 replies, so replies window should be truncated at replies_limit (5)
      const thread1: any = result.items.find((item: any) => item.id === 10);
      expect(thread1.replies_count).toBe(7);
      expect(thread1.has_more_replies).toBe(true);
      expect(thread1.replies).toHaveLength(5);

      // Root 2 has 2 replies, which is <= 5, so has_more_replies should be false
      const thread2: any = result.items.find((item: any) => item.id === 20);
      expect(thread2.replies_count).toBe(2);
      expect(thread2.has_more_replies).toBe(false);
      expect(thread2.replies).toHaveLength(2);
    });

    it('orders root comments by latest activity (recent reply surfacing root to top)', async () => {
      // Root 1 created earlier (Jan 1) but has a very recent reply (Jan 20)
      const root1 = {
        id: 10,
        recipe_id: 1,
        user_id: 1,
        parent_id: null,
        content: 'Older thread with recent activity',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-01-01'),
        replies: [
          {
            id: 101,
            recipe_id: 1,
            user_id: 2,
            parent_id: 10,
            content: 'Recent reply',
            is_active: true,
            is_edited: false,
            created_at: new Date('2026-01-20'),
          },
        ],
        _count: { replies: 1 },
      };

      // Root 2 created later (Jan 10) but has no newer replies
      const root2 = {
        id: 20,
        recipe_id: 1,
        user_id: 3,
        parent_id: null,
        content: 'Newer thread without replies',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-01-10'),
        replies: [],
        _count: { replies: 0 },
      };

      mockPrisma.comment.findMany.mockResolvedValueOnce([root1, root2]);
      mockPrisma.report.groupBy.mockResolvedValueOnce([]);

      const result = await service.findAllAdminComments({
        format: AdminCommentFormat.threaded,
      });

      // Root 1 latest activity is Jan 20 > Root 2 Jan 10
      expect(result.items[0].id).toBe(10);
      expect(result.items[1].id).toBe(20);
    });
  });
});
