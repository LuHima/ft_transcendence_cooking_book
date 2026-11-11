import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AdminCommentsController } from './admin-comments.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { BanHistoryService } from '../reports/ban-history.service';
import {
  AdminCommentSortBy,
  AdminCommentFormat,
  AdminCommentStatus,
} from './dto/admin-comment-query.dto';
import { SortOrder } from '../common/dto/sort-order.enum';

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
        findMany: jest.fn(),
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
        {
          provide: BanHistoryService,
          useValue: {
            getUserBanHistory: jest.fn(),
            recordBan: jest.fn(),
            recordUnban: jest.fn(),
            getPreviousBansCount: jest.fn(),
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

      const query = {
        page: 1,
        limit: 20,
        sort_by: AdminCommentSortBy.created_at,
        sort_order: SortOrder.desc,
      };
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

    it('sorts by recipe: groups comments by recipe ID asc, then created_at desc by default', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({ sort_by: AdminCommentSortBy.recipe });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ recipe_id: 'asc' }, { created_at: 'desc' }],
        }),
      );
    });

    it('sorts by recipe with explicit sort_order desc', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({
        sort_by: AdminCommentSortBy.recipe,
        sort_order: SortOrder.desc,
      });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ recipe_id: 'desc' }, { created_at: 'desc' }],
        }),
      );
    });

    it('sorts by created_at: orders comments by created_at desc by default', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({
        sort_by: AdminCommentSortBy.created_at,
      });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'desc' },
        }),
      );
    });

    it('sorts by created_at with explicit sort_order asc', async () => {
      mockPrisma.comment.findMany.mockResolvedValueOnce([]);
      mockPrisma.comment.count.mockResolvedValueOnce(0);

      await service.findAllAdminComments({
        sort_by: AdminCommentSortBy.created_at,
        sort_order: SortOrder.asc,
      });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { created_at: 'asc' },
        }),
      );
    });

    it('sorts by reports_count: orders comments by highest report frequency descending by default', async () => {
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
        sort_by: AdminCommentSortBy.reports_count,
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

    it('sorts by reports_count with explicit sort_order asc: orders comments by lowest report frequency ascending', async () => {
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
        sort_by: AdminCommentSortBy.reports_count,
        sort_order: SortOrder.asc,
      });

      expect(result.items).toHaveLength(3);
      // Comment C (0 reports) should be first
      expect(result.items[0].id).toBe(3);
      expect(result.items[0].reports_count).toBe(0);
      // Comment A (1 report) should be second
      expect(result.items[1].id).toBe(1);
      expect(result.items[1].reports_count).toBe(1);
      // Comment B (5 reports) should be third
      expect(result.items[2].id).toBe(2);
      expect(result.items[2].reports_count).toBe(5);
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

      // Verify Prisma query requested replies in ascending chronological order
      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            replies: expect.objectContaining({
              orderBy: { created_at: 'asc' },
            }),
          }),
        }),
      );

      // Root 1 has 7 replies, so replies window should be truncated at replies_limit (5)
      const thread1: any = result.items.find((item: any) => item.id === 10);
      expect(thread1.replies_count).toBe(7);
      expect(thread1.has_more_replies).toBe(true);
      expect(thread1.replies).toHaveLength(5);
      // Verify windowed preview reflects earliest chronological replies
      expect(thread1.replies.map((r: any) => r.id)).toEqual([
        100, 101, 102, 103, 104,
      ]);

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

  describe('Reported Comments Filtering & Guaranteed Reply Previews (Ticket #155)', () => {
    it('filters comments having pending reports in flat mode, defaulting to reports_count desc', async () => {
      mockPrisma.report.findMany.mockResolvedValueOnce([
        { target_id: 1 },
        { target_id: 2 },
      ]);

      const comment1 = {
        id: 1,
        recipe_id: 10,
        user_id: 100,
        parent_id: null,
        content: 'Abusive remark 1',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-11-01'),
        user: { id: 100, username: 'spammer1', avatar_url: null },
        recipe: { id: 10, source_lang: 'it', translations: [{ locale: 'it', title: 'Pizza' }] },
      };
      const comment2 = {
        id: 2,
        recipe_id: 10,
        user_id: 101,
        parent_id: null,
        content: 'Abusive remark 2',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-11-02'),
        user: { id: 101, username: 'spammer2', avatar_url: null },
        recipe: { id: 10, source_lang: 'it', translations: [{ locale: 'it', title: 'Pizza' }] },
      };

      mockPrisma.comment.findMany.mockResolvedValueOnce([comment1, comment2]);
      mockPrisma.report.groupBy.mockResolvedValueOnce([
        { target_id: 1, status: 'pending', _count: { id: 1 } },
        { target_id: 2, status: 'pending', _count: { id: 3 } },
      ]);

      const result = await service.findAllAdminComments({
        reported_only: true,
      });

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
        where: {
          subject: 'comment',
          status: 'pending',
        },
        select: { target_id: true },
      });

      expect(result.items).toHaveLength(2);
      // Contextual default sorting: reports_count desc -> comment 2 (3 reports) first, comment 1 (1 report) second
      expect(result.items[0].id).toBe(2);
      expect(result.items[0].reports_count).toBe(3);
      expect(result.items[0].pending_reports_count).toBe(3);
      expect(result.items[0].has_pending_reports).toBe(true);

      expect(result.items[1].id).toBe(1);
      expect(result.items[1].reports_count).toBe(1);
      expect(result.items[1].pending_reports_count).toBe(1);
      expect(result.items[1].has_pending_reports).toBe(true);
    });

    it('in threaded mode, guarantees inclusion of reported child replies in preview window and adds reported_replies_count', async () => {
      // Pending report is on reply 105 (child of root 10)
      mockPrisma.report.findMany.mockResolvedValueOnce([{ target_id: 105 }]);

      // Mock finding parent of reported comment
      mockPrisma.comment.findMany.mockResolvedValueOnce([
        { id: 105, parent_id: 10 },
      ]);

      const replies = [
        {
          id: 101,
          recipe_id: 1,
          user_id: 2,
          parent_id: 10,
          content: 'Normal reply 1',
          is_active: true,
          is_edited: false,
          created_at: new Date('2026-01-01'),
        },
        {
          id: 102,
          recipe_id: 1,
          user_id: 3,
          parent_id: 10,
          content: 'Normal reply 2',
          is_active: true,
          is_edited: false,
          created_at: new Date('2026-01-02'),
        },
        {
          id: 103,
          recipe_id: 1,
          user_id: 4,
          parent_id: 10,
          content: 'Normal reply 3',
          is_active: true,
          is_edited: false,
          created_at: new Date('2026-01-03'),
        },
        {
          id: 104,
          recipe_id: 1,
          user_id: 5,
          parent_id: 10,
          content: 'Normal reply 4',
          is_active: true,
          is_edited: false,
          created_at: new Date('2026-01-04'),
        },
        {
          id: 105,
          recipe_id: 1,
          user_id: 6,
          parent_id: 10,
          content: 'Reported offensive child reply',
          is_active: true,
          is_edited: false,
          created_at: new Date('2026-01-05'),
        },
      ];

      const root10 = {
        id: 10,
        recipe_id: 1,
        user_id: 1,
        parent_id: null,
        content: 'Root thread with reported child',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-01-01'),
        replies,
        _count: { replies: 5 },
      };

      // Second findMany returns root comments
      mockPrisma.comment.findMany.mockResolvedValueOnce([root10]);
      mockPrisma.report.groupBy.mockResolvedValue([
        { target_id: 105, status: 'pending', _count: { id: 2 } },
      ]);

      const result = await service.findAllAdminComments({
        format: AdminCommentFormat.threaded,
        reported_only: true,
        replies_limit: 2, // Preview limit is 2, so reply 105 at index 4 would normally be cut off!
      });

      expect(result.items).toHaveLength(1);
      const rootItem = result.items[0] as any;
      expect(rootItem.id).toBe(10);
      expect(rootItem.reported_replies_count).toBe(1);

      // Reply preview array must guarantee inclusion of reported child reply 105
      expect(rootItem.replies).toHaveLength(2);
      const replyIds = rootItem.replies.map((r: any) => r.id);
      expect(replyIds).toContain(105);

      const reportedReplyItem = rootItem.replies.find((r: any) => r.id === 105);
      expect(reportedReplyItem.has_pending_reports).toBe(true);
      expect(reportedReplyItem.pending_reports_count).toBe(2);
    });
  });

  describe('Ticket #163: Empty Filter Guards, Cumulative Threaded Report Ranking & Pending Lookup Deduplication', () => {
    it('returns empty result when reported_only=true and zero pending reports exist (flat mode)', async () => {
      mockPrisma.report.findMany.mockResolvedValueOnce([]); // No pending reports

      const result = await service.findAllAdminComments({
        reported_only: true,
        format: AdminCommentFormat.flat,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    it('returns empty result when reported_only=true and zero pending reports exist (threaded mode)', async () => {
      mockPrisma.report.findMany.mockResolvedValueOnce([]); // No pending reports

      const result = await service.findAllAdminComments({
        reported_only: true,
        format: AdminCommentFormat.threaded,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockPrisma.comment.findMany).not.toHaveBeenCalled();
    });

    it('ranks threads by cumulative pending reports across root and child replies in format=threaded', async () => {
      // Thread 1: Root 1 (0 pending) + Child 11 (3 pending) -> Cumulative: 3
      // Thread 2: Root 2 (1 pending) + Child 21 (0 pending) -> Cumulative: 1
      const thread1 = {
        id: 1,
        recipe_id: 10,
        user_id: 100,
        parent_id: null,
        content: 'Root 1 (no reports)',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-01-01T10:00:00Z'),
        replies: [
          {
            id: 11,
            recipe_id: 10,
            user_id: 101,
            parent_id: 1,
            content: 'Child 11 (heavily reported)',
            is_active: true,
            is_edited: false,
            created_at: new Date('2026-01-01T11:00:00Z'),
          },
        ],
        _count: { replies: 1 },
      };

      const thread2 = {
        id: 2,
        recipe_id: 10,
        user_id: 200,
        parent_id: null,
        content: 'Root 2 (1 report)',
        is_active: true,
        is_edited: false,
        created_at: new Date('2026-01-02T10:00:00Z'),
        replies: [
          {
            id: 21,
            recipe_id: 10,
            user_id: 201,
            parent_id: 2,
            content: 'Child 21 (clean)',
            is_active: true,
            is_edited: false,
            created_at: new Date('2026-01-02T11:00:00Z'),
          },
        ],
        _count: { replies: 1 },
      };

      mockPrisma.comment.findMany.mockResolvedValueOnce([thread2, thread1]);
      mockPrisma.report.groupBy.mockResolvedValue([
        { target_id: 11, status: 'pending', _count: { id: 3 } },
        { target_id: 2, status: 'pending', _count: { id: 1 } },
      ]);

      const result = await service.findAllAdminComments({
        format: AdminCommentFormat.threaded,
        sort_by: AdminCommentSortBy.reports_count,
      });

      expect(result.items).toHaveLength(2);
      // Thread 1 should be ranked first because cumulative pending is 3 vs 1
      expect(result.items[0].id).toBe(1);
      expect(
        (result.items[0] as any).thread_pending_reports_count,
      ).toBe(3);

      expect(result.items[1].id).toBe(2);
      expect(
        (result.items[1] as any).thread_pending_reports_count,
      ).toBe(1);
    });
  });
});
