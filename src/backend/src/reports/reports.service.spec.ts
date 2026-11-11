import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from 'prisma/prisma.service';
import { RecipeService } from '../recipe/recipe.service';
import { BanHistoryService } from './ban-history.service';
import {
  ReportReason,
  ReportStatus,
  ReportSubject,
  Role,
  UserStatus,
} from '@prisma/client';
import { ReportAction } from './dto/update-report.dto';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrisma = {
    recipe: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    comment: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    report: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    jwtSession: {
      deleteMany: jest.fn(),
    },
    banHistory: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockRecipeService = {
    deactivateRecipe: jest.fn(),
  };

  const mockBanHistoryService = {
    recordBan: jest.fn().mockResolvedValue({ id: 'ban-1' }),
    recordUnban: jest.fn().mockResolvedValue({ id: 'ban-1' }),
    getPreviousBansCount: jest.fn().mockResolvedValue(0),
    getUserBanHistory: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: RecipeService,
          useValue: mockRecipeService,
        },
        {
          provide: BanHistoryService,
          useValue: mockBanHistoryService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    jest.clearAllMocks();
  });

  describe('createReport', () => {
    it('creates a report for an existing recipe target', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 10 });
      mockPrisma.report.findFirst.mockResolvedValueOnce(null);
      mockPrisma.report.create.mockResolvedValueOnce({
        id: 1,
        reporter_id: 5,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.harassment_bullying,
        description: 'Offensive title',
        status: ReportStatus.pending,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.createReport(5, {
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.harassment_bullying,
        description: 'Offensive title',
      });

      expect(mockPrisma.recipe.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { id: true },
      });
      expect(mockPrisma.report.create).toHaveBeenCalled();
      expect(result.id).toBe(1);
      expect(result.previous_bans_count).toBe(0);
    });

    it('creates a report for an existing comment target', async () => {
      mockPrisma.comment.findUnique.mockResolvedValueOnce({ id: 25 });
      mockPrisma.report.findFirst.mockResolvedValueOnce(null);
      mockPrisma.report.create.mockResolvedValueOnce({
        id: 2,
        reporter_id: 5,
        subject: ReportSubject.comment,
        target_id: 25,
        reason: ReportReason.spam_scam,
        description: null,
        status: ReportStatus.pending,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.createReport(5, {
        subject: ReportSubject.comment,
        target_id: 25,
        reason: ReportReason.spam_scam,
      });

      expect(mockPrisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 25 },
        select: { id: true },
      });
      expect(result.id).toBe(2);
    });

    it('creates a report for an existing user target', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 42 });
      mockPrisma.report.findFirst.mockResolvedValueOnce(null);
      mockPrisma.report.create.mockResolvedValueOnce({
        id: 3,
        reporter_id: 5,
        subject: ReportSubject.user,
        target_id: 42,
        reason: ReportReason.hate_speech,
        description: 'Abusive bio',
        status: ReportStatus.pending,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.createReport(5, {
        subject: ReportSubject.user,
        target_id: 42,
        reason: ReportReason.hate_speech,
        description: 'Abusive bio',
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 42, deleted_at: null },
        select: { id: true },
      });
      expect(result.id).toBe(3);
    });

    it('throws NotFoundException when target recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createReport(5, {
          subject: ReportSubject.recipe,
          target_id: 999,
          reason: ReportReason.spam_scam,
        }),
      ).rejects.toThrow(new NotFoundException('Target item not found'));
    });

    it('throws NotFoundException when target comment does not exist', async () => {
      mockPrisma.comment.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createReport(5, {
          subject: ReportSubject.comment,
          target_id: 999,
          reason: ReportReason.spam_scam,
        }),
      ).rejects.toThrow(new NotFoundException('Target item not found'));
    });

    it('throws NotFoundException when target user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createReport(5, {
          subject: ReportSubject.user,
          target_id: 999,
          reason: ReportReason.spam_scam,
        }),
      ).rejects.toThrow(new NotFoundException('Target item not found'));
    });

    it('throws ConflictException when duplicate pending report exists from same reporter', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 10 });
      mockPrisma.report.findFirst.mockResolvedValueOnce({ id: 99 });

      await expect(
        service.createReport(5, {
          subject: ReportSubject.recipe,
          target_id: 10,
          reason: ReportReason.spam_scam,
        }),
      ).rejects.toThrow(
        new ConflictException('A pending report already exists for this item'),
      );
    });
  });

  describe('getReports', () => {
    it('returns paginated reports with hydrated previous_bans_count', async () => {
      const reports = [
        {
          id: 1,
          reporter_id: 5,
          subject: ReportSubject.recipe,
          target_id: 10,
          reason: ReportReason.spam_scam,
          description: null,
          status: ReportStatus.pending,
          resolution_notes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      mockPrisma.report.findMany.mockResolvedValueOnce(reports);
      mockPrisma.report.count.mockResolvedValueOnce(1);
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ user_id: 50 });
      mockBanHistoryService.getPreviousBansCount.mockResolvedValueOnce(2);

      const result = await service.getReports({ page: 1, limit: 10 });

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { created_at: 'desc' },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].previous_bans_count).toBe(2);
      expect(result.total).toBe(1);
    });

    it('hydrates reporter details and polymorphic targets across recipe, comment, and user subjects (Ticket #156)', async () => {
      const reports = [
        {
          id: 101,
          reporter_id: 1,
          subject: ReportSubject.recipe,
          target_id: 42,
          reason: ReportReason.inappropriate_content,
          description: 'Spam recipe',
          status: ReportStatus.pending,
          created_at: new Date('2026-11-01'),
          updated_at: new Date('2026-11-01'),
        },
        {
          id: 102,
          reporter_id: 2,
          subject: ReportSubject.comment,
          target_id: 77,
          reason: ReportReason.harassment_bullying,
          description: 'Insulting remark',
          status: ReportStatus.pending,
          created_at: new Date('2026-11-02'),
          updated_at: new Date('2026-11-02'),
        },
        {
          id: 103,
          reporter_id: 3,
          subject: ReportSubject.user,
          target_id: 99,
          reason: ReportReason.impersonation,
          description: 'Fake profile',
          status: ReportStatus.pending,
          created_at: new Date('2026-11-03'),
          updated_at: new Date('2026-11-03'),
        },
      ];

      mockPrisma.report.findMany.mockResolvedValueOnce(reports);
      mockPrisma.report.count.mockResolvedValueOnce(3);

      // Reporter mock responses
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: 1, username: 'reporter1', avatar_url: '/avatars/1.webp' })
        .mockResolvedValueOnce({ id: 2, username: 'reporter2', avatar_url: null })
        .mockResolvedValueOnce({ id: 3, username: 'reporter3', avatar_url: '/avatars/3.webp' });

      // Target mocks:
      // 1. Recipe 42
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 42,
        user_id: 501,
        source_lang: 'it',
        translations: [{ locale: 'it', title: 'Pizza Margherita' }],
        user: { id: 501, username: 'chef_mario' },
      });

      // 2. Comment 77
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 77,
        content: 'This recipe is terrible!',
        recipe_id: 42,
        user_id: 502,
        user: { id: 502, username: 'troll_user' },
      });

      // 3. User 99 (second call to user.findUnique for target user)
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 99,
        username: 'fake_account',
      });

      mockBanHistoryService.getPreviousBansCount.mockResolvedValue(0);

      const result = await service.getReports({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(3);

      // Report 1: Recipe subject
      expect(result.items[0].reporter).toEqual({
        id: 1,
        username: 'reporter1',
        avatar_url: '/avatars/1.webp',
      });
      expect(result.items[0].target).toEqual({
        label: 'Pizza Margherita',
        recipe_id: 42,
        owner: { id: 501, username: 'chef_mario' },
      });

      // Report 2: Comment subject
      expect(result.items[1].reporter).toEqual({
        id: 2,
        username: 'reporter2',
        avatar_url: null,
      });
      expect(result.items[1].target).toEqual({
        label: 'This recipe is terrible!',
        recipe_id: 42,
        owner: { id: 502, username: 'troll_user' },
      });

      // Report 3: User subject
      expect(result.items[2].reporter).toEqual({
        id: 3,
        username: 'reporter3',
        avatar_url: '/avatars/3.webp',
      });
      expect(result.items[2].target).toEqual({
        label: 'fake_account',
        owner: { id: 99, username: 'fake_account' },
      });
    });
  });

  describe('updateReport', () => {
    it('throws NotFoundException when report does not exist', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateReport(999, {
          status: ReportStatus.reviewed,
        }),
      ).rejects.toThrow(new NotFoundException('Report not found'));
    });

    it('updates report status and resolution notes successfully', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        reason: ReportReason.harassment_bullying,
      });
      const updated = {
        id: 1,
        reporter_id: 5,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.harassment_bullying,
        description: null,
        status: ReportStatus.reviewed,
        resolution_notes: 'Reviewed without action',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrisma.report.update.mockResolvedValueOnce(updated);

      const result = await service.updateReport(1, {
        status: ReportStatus.reviewed,
        resolution_notes: 'Reviewed without action',
      });

      expect(result.status).toBe(ReportStatus.reviewed);
      expect(mockPrisma.report.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            status: ReportStatus.reviewed,
            resolution_notes: 'Reviewed without action',
          }),
        }),
      );
    });

    it('executes composite action [delete_content, ban] atomically', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.hate_speech,
        status: ReportStatus.pending,
      });
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 42,
        user: { id: 42, role: Role.user },
      });
      mockPrisma.recipe.update.mockResolvedValueOnce({
        id: 10,
        is_active: false,
      });
      mockPrisma.user.update.mockResolvedValueOnce({
        id: 42,
        status: UserStatus.banned,
      });
      mockPrisma.recipe.updateMany.mockResolvedValueOnce({ count: 2 });
      mockPrisma.jwtSession.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.report.update.mockResolvedValueOnce({
        id: 1,
        status: ReportStatus.action_taken,
        resolution_reason: ReportReason.hate_speech,
        resolution_description:
          'Offensive content violating community guidelines',
        resolved_by_id: 1,
      });
      mockBanHistoryService.getPreviousBansCount.mockResolvedValueOnce(1);

      const caller = { id: 1, role: Role.admin };
      const result = await service.updateReport(
        1,
        {
          actions: [ReportAction.delete_content, ReportAction.ban],
          resolution_reason: ReportReason.hate_speech,
          resolution_description:
            'Offensive content violating community guidelines',
          resolution_notes: 'Recipe removed and author banned for hate speech',
        },
        caller,
      );

      // Recipe deactivated
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { is_active: false },
      });
      // User banned
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: expect.objectContaining({
          status: UserStatus.banned,
          banned_until: expect.any(Date),
        }),
      });
      // Authored recipes suspended
      expect(mockPrisma.recipe.updateMany).toHaveBeenCalledWith({
        where: { user_id: 42, is_active: true },
        data: { is_active: false },
      });
      // Sessions evicted
      expect(mockPrisma.jwtSession.deleteMany).toHaveBeenCalledWith({
        where: { id_user: 42 },
      });
      // Ban history recorded
      expect(mockBanHistoryService.recordBan).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 42,
          bannedById: 1,
          reason: ReportReason.hate_speech,
          durationDays: 30, // policy default for hate_speech
          isPermanent: false,
        }),
        mockPrisma,
      );
      expect(result.status).toBe(ReportStatus.action_taken);
    });

    it('throws ForbiddenException when moderator attempts ban exceeding 180 days', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.violence_threats,
      });
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 42,
        user: { id: 42, role: Role.user },
      });

      const caller = { id: 2, role: Role.moderator };
      await expect(
        service.updateReport(
          1,
          {
            actions: [ReportAction.ban],
            ban_duration_days: 181,
          },
          caller,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('throws ForbiddenException when moderator attempts permanent ban', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.violence_threats,
      });
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 42,
        user: { id: 42, role: Role.user },
      });

      const caller = { id: 2, role: Role.moderator };
      await expect(
        service.updateReport(
          1,
          {
            actions: [ReportAction.ban],
            is_permanent: true,
          },
          caller,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('allows administrator to issue a permanent ban', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.violence_threats,
      });
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 42,
        user: { id: 42, role: Role.user },
      });
      mockPrisma.user.update.mockResolvedValueOnce({
        id: 42,
        status: UserStatus.banned,
      });
      mockPrisma.recipe.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.jwtSession.deleteMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.report.update.mockResolvedValueOnce({
        id: 1,
        status: ReportStatus.action_taken,
      });

      const caller = { id: 1, role: Role.admin };
      await service.updateReport(
        1,
        {
          actions: [ReportAction.ban],
          is_permanent: true,
        },
        caller,
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: {
          status: UserStatus.banned,
          banned_until: null,
        },
      });
      expect(mockBanHistoryService.recordBan).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 42,
          isPermanent: true,
          durationDays: null,
          expiresAt: null,
        }),
        mockPrisma,
      );
    });

    it('throws ForbiddenException when moderator attempts to moderate administrator content', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
      });
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 99,
        user: { id: 99, role: Role.admin },
      });

      const caller = { id: 2, role: Role.moderator };
      await expect(
        service.updateReport(
          1,
          {
            actions: [ReportAction.delete_content],
          },
          caller,
        ),
      ).rejects.toThrow(
        'Moderators cannot moderate or delete administrator content',
      );
    });

    it('throws ForbiddenException when moderator attempts to ban administrator', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
      });
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 99,
        user: { id: 99, role: Role.admin },
      });

      const caller = { id: 2, role: Role.moderator };
      await expect(
        service.updateReport(
          1,
          {
            actions: [ReportAction.ban],
          },
          caller,
        ),
      ).rejects.toThrow('Moderators cannot moderate or ban administrator');
    });

    it('deactivates comment without overwriting its content on delete_content', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 2,
        subject: ReportSubject.comment,
        target_id: 55,
        reason: ReportReason.harassment_bullying,
      });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 55,
        user_id: 30,
        user: { id: 30, role: Role.user },
      });
      mockPrisma.comment.update.mockResolvedValueOnce({
        id: 55,
        is_active: false,
      });
      mockPrisma.report.update.mockResolvedValueOnce({
        id: 2,
        status: ReportStatus.action_taken,
      });

      const caller = { id: 2, role: Role.moderator };
      await service.updateReport(
        2,
        {
          actions: [ReportAction.delete_content],
        },
        caller,
      );

      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: 55 },
        data: { is_active: false },
      });
    });

    it('rolls back all actions if any step in atomic transaction fails', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.spam_scam,
      });
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 42,
        user: { id: 42, role: Role.user },
      });
      mockPrisma.recipe.update.mockResolvedValueOnce({
        id: 10,
        is_active: false,
      });
      // Simulate user update failing in composite action
      mockPrisma.user.update.mockRejectedValueOnce(
        new Error('Database disk full'),
      );

      const caller = { id: 1, role: Role.admin };
      await expect(
        service.updateReport(
          1,
          {
            actions: [ReportAction.delete_content, ReportAction.ban],
          },
          caller,
        ),
      ).rejects.toThrow('Database disk full');
    });
  });
});
