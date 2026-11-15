import { Test, TestingModule } from '@nestjs/testing';
import { BanHistoryService } from './ban-history.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ReportAction, ReportReason } from '@prisma/client';
import { SortOrder } from '../common/dto/sort-order.enum';

describe('BanHistoryService', () => {
  let service: BanHistoryService;

  const mockPrisma = {
    banHistory: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BanHistoryService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<BanHistoryService>(BanHistoryService);
    jest.clearAllMocks();
  });

  describe('recordSanction', () => {
    it('creates an immutable ban history record for temporary ban', async () => {
      const expiresAt = new Date(Date.now() + 30 * 86400000);
      const expectedRecord = {
        id: 'ban-uuid-1',
        user_id: 10,
        banned_by_id: 1,
        report_id: 5,
        action: ReportAction.ban,
        reason: ReportReason.harassment_bullying,
        description: 'Repeated offensive comments',
        duration_days: 30,
        is_permanent: false,
        banned_at: new Date(),
        expires_at: expiresAt,
        unbanned_at: null,
        unbanned_by_id: null,
        unban_reason: null,
      };

      mockPrisma.banHistory.create.mockResolvedValueOnce(expectedRecord);

      const result = await service.recordSanction({
        userId: 10,
        bannedById: 1,
        reason: ReportReason.harassment_bullying,
        description: 'Repeated offensive comments',
        durationDays: 30,
        isPermanent: false,
        reportId: 5,
        expiresAt,
      });

      expect(mockPrisma.banHistory.create).toHaveBeenCalledWith({
        data: {
          user_id: 10,
          banned_by_id: 1,
          report_id: 5,
          action: ReportAction.ban,
          reason: ReportReason.harassment_bullying,
          description: 'Repeated offensive comments',
          internal_notes: null,
          duration_days: 30,
          is_permanent: false,
          expires_at: expiresAt,
        },
      });
      expect(result).toEqual(expectedRecord);
    });

    it('sets duration_days to null when ban is permanent', async () => {
      mockPrisma.banHistory.create.mockResolvedValueOnce({
        id: 'ban-uuid-2',
        user_id: 10,
        action: ReportAction.ban,
        is_permanent: true,
        duration_days: null,
      });

      await service.recordSanction({
        userId: 10,
        bannedById: 1,
        reason: ReportReason.violence_threats,
        durationDays: 60,
        isPermanent: true,
      });

      expect(mockPrisma.banHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: ReportAction.ban,
          duration_days: null,
          is_permanent: true,
          expires_at: null,
        }) as unknown,
      });
    });

    it('records a warning sanction with action: warn, duration_days: null, is_permanent: false, expires_at: null', async () => {
      const expectedRecord = {
        id: 'warn-uuid-1',
        user_id: 10,
        banned_by_id: 2,
        report_id: 8,
        action: ReportAction.warn,
        reason: ReportReason.harassment_bullying,
        description: 'First warning for disrespectful language',
        duration_days: null,
        is_permanent: false,
        banned_at: new Date(),
        expires_at: null,
      };

      mockPrisma.banHistory.create.mockResolvedValueOnce(expectedRecord);

      const result = await service.recordSanction({
        userId: 10,
        bannedById: 2,
        reason: ReportReason.harassment_bullying,
        action: ReportAction.warn,
        description: 'First warning for disrespectful language',
        reportId: 8,
        durationDays: 14,
        isPermanent: true,
        expiresAt: new Date(),
      });

      expect(mockPrisma.banHistory.create).toHaveBeenCalledWith({
        data: {
          user_id: 10,
          banned_by_id: 2,
          report_id: 8,
          action: ReportAction.warn,
          reason: ReportReason.harassment_bullying,
          description: 'First warning for disrespectful language',
          internal_notes: null,
          duration_days: null,
          is_permanent: false,
          expires_at: null,
        },
      });
      expect(result).toEqual(expectedRecord);
    });

    it('persists trimmed internal_notes and defaults blank internal_notes to null', async () => {
      mockPrisma.banHistory.create.mockResolvedValueOnce({
        id: 'ban-uuid-notes',
        internal_notes: 'Staff confidential context',
      });

      await service.recordSanction({
        userId: 10,
        bannedById: 2,
        reason: ReportReason.spam_scam,
        action: ReportAction.ban,
        internalNotes: '  Staff confidential context  ',
      });

      expect(mockPrisma.banHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          internal_notes: 'Staff confidential context',
        }),
      });

      mockPrisma.banHistory.create.mockResolvedValueOnce({
        id: 'ban-uuid-blank',
        internal_notes: null,
      });

      await service.recordSanction({
        userId: 10,
        bannedById: 2,
        reason: ReportReason.spam_scam,
        action: ReportAction.warn,
        internalNotes: '   ',
      });

      expect(mockPrisma.banHistory.create).toHaveBeenLastCalledWith({
        data: expect.objectContaining({
          internal_notes: null,
        }),
      });
    });
  });

  describe('recordUnban', () => {
    it('updates latest active ban with unban metadata', async () => {
      const activeBan = {
        id: 'ban-uuid-1',
        user_id: 10,
        action: ReportAction.ban,
        unbanned_at: null,
      };
      const unbannedRecord = {
        ...activeBan,
        unbanned_at: new Date(),
        unbanned_by_id: 1,
        unban_reason: 'Appeal approved',
      };

      mockPrisma.banHistory.findFirst.mockResolvedValueOnce(activeBan);
      mockPrisma.banHistory.update.mockResolvedValueOnce(unbannedRecord);

      const result = await service.recordUnban(10, 1, 'Appeal approved');

      expect(mockPrisma.banHistory.findFirst).toHaveBeenCalledWith({
        where: { user_id: 10, action: ReportAction.ban, unbanned_at: null },
        orderBy: { banned_at: 'desc' },
      });
      const calls = mockPrisma.banHistory.update.mock.calls as unknown[][];
      const updateCall = calls[0]?.[0] as {
        where: { id: string };
        data: {
          unbanned_at: unknown;
          unbanned_by_id: number;
          unban_reason: string;
        };
      };
      expect(updateCall.where).toEqual({ id: 'ban-uuid-1' });
      expect(updateCall.data.unbanned_at).toBeInstanceOf(Date);
      expect(updateCall.data.unbanned_by_id).toBe(1);
      expect(updateCall.data.unban_reason).toBe('Appeal approved');
      expect(result).toEqual(unbannedRecord);
    });

    it('returns null when no active ban is found', async () => {
      mockPrisma.banHistory.findFirst.mockResolvedValueOnce(null);

      const result = await service.recordUnban(10, 1);

      expect(result).toBeNull();
      expect(mockPrisma.banHistory.update).not.toHaveBeenCalled();
    });
  });

  describe('getPreviousBansCount', () => {
    it('returns historical ban count for a user (strictly action: ban)', async () => {
      mockPrisma.banHistory.count.mockResolvedValueOnce(3);

      const count = await service.getPreviousBansCount(10);

      expect(mockPrisma.banHistory.count).toHaveBeenCalledWith({
        where: { user_id: 10, action: ReportAction.ban },
      });
      expect(count).toBe(3);
    });
  });

  describe('getPreviousWarningsCount', () => {
    it('returns historical warning count for a user (strictly action: warn)', async () => {
      mockPrisma.banHistory.count.mockResolvedValueOnce(2);

      const count = await service.getPreviousWarningsCount(10);

      expect(mockPrisma.banHistory.count).toHaveBeenCalledWith({
        where: { user_id: 10, action: ReportAction.warn },
      });
      expect(count).toBe(2);
    });
  });

  describe('getUserSanctionsHistory', () => {
    it('returns paginated chronological list of bans and warnings ordered desc by default', async () => {
      const historyList = [
        {
          id: 'ban-2',
          user_id: 10,
          action: ReportAction.ban,
          banned_at: new Date('2026-11-04'),
          banned_by: { id: 1, username: 'admin_1', avatar_url: null },
          unbanned_by: null,
        },
        {
          id: 'warn-1',
          user_id: 10,
          action: ReportAction.warn,
          banned_at: new Date('2026-10-01'),
          banned_by: null,
          unbanned_by: null,
        },
      ];
      mockPrisma.banHistory.findMany.mockResolvedValueOnce(historyList);
      mockPrisma.banHistory.count.mockResolvedValueOnce(2);

      const result = await service.getUserSanctionsHistory(10);

      expect(mockPrisma.banHistory.findMany).toHaveBeenCalledWith({
        where: { user_id: 10 },
        orderBy: { banned_at: 'desc' },
        skip: 0,
        take: 20,
        include: {
          banned_by: {
            select: { id: true, username: true, avatar_url: true },
          },
          unbanned_by: {
            select: { id: true, username: true, avatar_url: true },
          },
        },
      });
      expect(mockPrisma.banHistory.count).toHaveBeenCalledWith({
        where: { user_id: 10 },
      });
      expect(result).toEqual({
        items: historyList,
        total: 2,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      });
    });

    it('supports custom page, limit, and asc sort_order', async () => {
      mockPrisma.banHistory.findMany.mockResolvedValueOnce([]);
      mockPrisma.banHistory.count.mockResolvedValueOnce(25);

      const result = await service.getUserSanctionsHistory(10, {
        page: 2,
        limit: 10,
        sort_order: SortOrder.asc,
      });

      expect(mockPrisma.banHistory.findMany).toHaveBeenCalledWith({
        where: { user_id: 10 },
        orderBy: { banned_at: 'asc' },
        skip: 10,
        take: 10,
        include: {
          banned_by: {
            select: { id: true, username: true, avatar_url: true },
          },
          unbanned_by: {
            select: { id: true, username: true, avatar_url: true },
          },
        },
      });
      expect(result).toEqual({
        items: [],
        total: 25,
        page: 2,
        limit: 10,
        total_pages: 3,
        has_next_page: true,
        has_prev_page: true,
      });
    });

    it('returns empty envelope metadata when user has no history even on page > 1', async () => {
      mockPrisma.banHistory.findMany.mockResolvedValueOnce([]);
      mockPrisma.banHistory.count.mockResolvedValueOnce(0);

      const result = await service.getUserSanctionsHistory(10, {
        page: 2,
        limit: 20,
      });

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 2,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      });
    });

    it('hydrates banned_by and unbanned_by summaries and defaults missing actors to null', async () => {
      mockPrisma.banHistory.findMany.mockResolvedValueOnce([
        {
          id: 'ban-3',
          user_id: 10,
          banned_by_id: 5,
          unbanned_by_id: null,
          action: ReportAction.ban,
          banned_by: {
            id: 5,
            username: 'retired_mod',
            avatar_url: '/avatars/5.webp',
          },
          unbanned_by: null,
        },
        {
          id: 'ban-4',
          user_id: 10,
          banned_by_id: null,
          unbanned_by_id: 9,
          action: ReportAction.ban,
          banned_by: null,
          unbanned_by: {
            id: 9,
            username: 'admin_9',
            avatar_url: null,
          },
        },
      ]);
      mockPrisma.banHistory.count.mockResolvedValueOnce(2);

      const result = await service.getUserSanctionsHistory(10);

      expect(result.items[0].banned_by).toEqual({
        id: 5,
        username: 'retired_mod',
        avatar_url: '/avatars/5.webp',
      });
      expect(result.items[0].unbanned_by).toBeNull();
      expect(result.items[1].banned_by).toBeNull();
      expect(result.items[1].unbanned_by).toEqual({
        id: 9,
        username: 'admin_9',
        avatar_url: null,
      });
    });
  });

  describe('calculateProgressiveDuration', () => {
    it('applies doubling escalation formula min(base * 2^previousBans, cap)', () => {
      const base = 7;
      // 0 bans: 7 * 1 = 7
      expect(service.calculateProgressiveDuration(base, 0)).toBe(7);
      // 1 ban: 7 * 2 = 14
      expect(service.calculateProgressiveDuration(base, 1)).toBe(14);
      // 2 bans: 7 * 4 = 28
      expect(service.calculateProgressiveDuration(base, 2)).toBe(28);
      // 3 bans: 7 * 8 = 56
      expect(service.calculateProgressiveDuration(base, 3)).toBe(56);
      // 5 bans: 7 * 32 = 224 -> capped at 180
      expect(service.calculateProgressiveDuration(base, 5)).toBe(180);
    });
  });

  describe('getLatestActiveBan', () => {
    it('returns latest active ban filtering by action: ban', async () => {
      const activeBan = { id: 'ban-1', user_id: 10, action: ReportAction.ban };
      mockPrisma.banHistory.findFirst.mockResolvedValueOnce(activeBan);

      const result = await service.getLatestActiveBan(10);

      expect(mockPrisma.banHistory.findFirst).toHaveBeenCalledWith({
        where: { user_id: 10, action: ReportAction.ban },
        orderBy: { banned_at: 'desc' },
      });
      expect(result).toEqual(activeBan);
    });
  });
});
