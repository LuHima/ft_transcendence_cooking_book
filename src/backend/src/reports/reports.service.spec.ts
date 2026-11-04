import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from 'prisma/prisma.service';
import { RecipeService } from '../recipe/recipe.service';
import { ReportReason, ReportStatus, ReportSubject, Role, UserStatus } from '@prisma/client';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrisma = {
    recipe: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    comment: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
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
  };

  const mockRecipeService = {
    deactivateRecipe: jest.fn(),
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
        reason: ReportReason.harassment,
        description: 'Offensive title',
        status: ReportStatus.pending,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.createReport(5, {
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.harassment,
        description: 'Offensive title',
      });

      expect(mockPrisma.recipe.findUnique).toHaveBeenCalledWith({
        where: { id: 10 },
        select: { id: true },
      });
      expect(result.id).toBe(1);
      expect(result.status).toBe(ReportStatus.pending);
    });

    it('creates a report for an existing comment target', async () => {
      mockPrisma.comment.findUnique.mockResolvedValueOnce({ id: 25 });
      mockPrisma.report.findFirst.mockResolvedValueOnce(null);
      mockPrisma.report.create.mockResolvedValueOnce({
        id: 2,
        reporter_id: 5,
        subject: ReportSubject.comment,
        target_id: 25,
        reason: ReportReason.spam,
        description: null,
        status: ReportStatus.pending,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.createReport(5, {
        subject: ReportSubject.comment,
        target_id: 25,
        reason: ReportReason.spam,
      });

      expect(mockPrisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: 25 },
        select: { id: true },
      });
      expect(result.id).toBe(2);
    });

    it('creates a report for an existing user profile target', async () => {
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
          reason: ReportReason.spam,
        }),
      ).rejects.toThrow(new NotFoundException('Target item not found'));
    });

    it('throws NotFoundException when target comment does not exist', async () => {
      mockPrisma.comment.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createReport(5, {
          subject: ReportSubject.comment,
          target_id: 999,
          reason: ReportReason.spam,
        }),
      ).rejects.toThrow(new NotFoundException('Target item not found'));
    });

    it('throws NotFoundException when target user does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createReport(5, {
          subject: ReportSubject.user,
          target_id: 999,
          reason: ReportReason.spam,
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
          reason: ReportReason.spam,
        }),
      ).rejects.toThrow(
        new ConflictException('A pending report already exists for this item'),
      );
    });
  });

  describe('getReports', () => {
    it('returns paginated reports list with filter parameters', async () => {
      const mockReports = [
        {
          id: 1,
          reporter_id: 5,
          subject: ReportSubject.recipe,
          target_id: 10,
          reason: ReportReason.spam,
          description: null,
          status: ReportStatus.pending,
          resolution_notes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];
      mockPrisma.report.findMany.mockResolvedValueOnce(mockReports);
      mockPrisma.report.count.mockResolvedValueOnce(1);

      const result = await service.getReports({
        page: 1,
        limit: 20,
        status: ReportStatus.pending,
        subject: ReportSubject.recipe,
      });

      expect(result.items).toEqual(mockReports);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.total_pages).toBe(1);
      expect(result.has_next_page).toBe(false);
      expect(result.has_prev_page).toBe(false);
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
        where: {
          status: ReportStatus.pending,
          subject: ReportSubject.recipe,
        },
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('updateReport', () => {
    it('throws NotFoundException when report is not found', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateReport(999, {
          status: ReportStatus.reviewed,
        }),
      ).rejects.toThrow(new NotFoundException('Report not found'));
    });

    it('updates report status and resolution notes successfully', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({ id: 1 });
      const updated = {
        id: 1,
        reporter_id: 5,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.harassment,
        description: null,
        status: ReportStatus.action_taken,
        resolution_notes: 'Recipe removed and author issued warning',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockPrisma.report.update.mockResolvedValueOnce(updated);

      const result = await service.updateReport(1, {
        status: ReportStatus.action_taken,
        resolution_notes: 'Recipe removed and author issued warning',
      });

      expect(result).toEqual(updated);
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          status: ReportStatus.action_taken,
          resolution_notes: 'Recipe removed and author issued warning',
        },
      });
    });

    it('resolves report with delete_content and suspends target recipe', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        status: ReportStatus.pending,
      });
      mockRecipeService.deactivateRecipe.mockResolvedValueOnce({
        id: 10,
        is_active: false,
      });
      const updated = {
        id: 1,
        status: ReportStatus.action_taken,
        resolution_notes: 'Recipe suspended',
        resolved_by_id: 2,
        resolved_at: new Date(),
      };
      mockPrisma.report.update.mockResolvedValueOnce(updated);

      const caller = { id: 2, role: Role.moderator };
      const result = await service.updateReport(
        1,
        {
          status: ReportStatus.action_taken,
          resolution: 'delete_content',
          resolution_notes: 'Recipe suspended',
        },
        caller,
      );

      expect(mockRecipeService.deactivateRecipe).toHaveBeenCalledWith(10, caller);
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: expect.objectContaining({
          status: ReportStatus.action_taken,
          resolution_notes: 'Recipe suspended',
          resolved_by_id: 2,
        }),
      });
      expect(result).toEqual(updated);
    });

    it('throws ForbiddenException when moderator resolves report against admin recipe with delete_content', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        status: ReportStatus.pending,
      });
      mockRecipeService.deactivateRecipe.mockRejectedValueOnce(
        new ForbiddenException('Moderators cannot moderate or delete administrator recipes'),
      );

      const caller = { id: 2, role: Role.moderator };
      await expect(
        service.updateReport(
          1,
          {
            status: ReportStatus.action_taken,
            resolution: 'delete_content',
          },
          caller,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when moderator resolves report against admin author with ban', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        status: ReportStatus.pending,
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
            status: ReportStatus.action_taken,
            action: 'ban',
          },
          caller,
        ),
      ).rejects.toThrow('Moderators cannot moderate or delete administrator content');
    });

    it('resolves report with ban: bans author and deactivates all active recipes', async () => {
      mockPrisma.report.findUnique.mockResolvedValueOnce({
        id: 1,
        subject: ReportSubject.recipe,
        target_id: 10,
        status: ReportStatus.pending,
      });
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 50,
        user: { id: 50, role: Role.user },
      });
      mockPrisma.user.update.mockResolvedValueOnce({ id: 50, status: UserStatus.banned });
      mockPrisma.recipe.updateMany.mockResolvedValueOnce({ count: 3 });
      mockPrisma.jwtSession.deleteMany.mockResolvedValueOnce({ count: 1 });
      const updated = {
        id: 1,
        status: ReportStatus.action_taken,
        resolved_by_id: 1,
      };
      mockPrisma.report.update.mockResolvedValueOnce(updated);

      const caller = { id: 1, role: Role.admin };
      const result = await service.updateReport(
        1,
        {
          status: ReportStatus.action_taken,
          action: 'ban',
          resolution_notes: 'Banned author',
        },
        caller,
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 50 },
        data: { status: UserStatus.banned },
      });
      expect(mockPrisma.recipe.updateMany).toHaveBeenCalledWith({
        where: { user_id: 50, is_active: true },
        data: { is_active: false },
      });
      expect(mockPrisma.jwtSession.deleteMany).toHaveBeenCalledWith({
        where: { id_user: 50 },
      });
      expect(result).toEqual(updated);
    });
  });
});
