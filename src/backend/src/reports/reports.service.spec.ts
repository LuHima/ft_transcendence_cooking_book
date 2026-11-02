import { NotFoundException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from 'prisma/prisma.service';
import { ReportReason, ReportStatus, ReportSubject } from '@prisma/client';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrisma = {
    recipe: {
      findUnique: jest.fn(),
    },
    comment: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    report: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
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
  });
});
