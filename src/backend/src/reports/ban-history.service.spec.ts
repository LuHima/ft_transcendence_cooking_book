import { Test, TestingModule } from '@nestjs/testing';
import { BanHistoryService } from './ban-history.service';
import { PrismaService } from 'prisma/prisma.service';
import { ReportReason } from '@prisma/client';

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

  describe('recordBan', () => {
    it('creates an immutable ban history record for temporary ban', async () => {
      const expiresAt = new Date(Date.now() + 30 * 86400000);
      const expectedRecord = {
        id: 'ban-uuid-1',
        user_id: 10,
        banned_by_id: 1,
        report_id: 5,
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

      const result = await service.recordBan({
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
          reason: ReportReason.harassment_bullying,
          description: 'Repeated offensive comments',
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
        is_permanent: true,
        duration_days: null,
      });

      await service.recordBan({
        userId: 10,
        bannedById: 1,
        reason: ReportReason.violence_threats,
        durationDays: 60,
        isPermanent: true,
      });

      expect(mockPrisma.banHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          duration_days: null,
          is_permanent: true,
          expires_at: null,
        }),
      });
    });
  });

  describe('recordUnban', () => {
    it('updates latest active ban with unban metadata', async () => {
      const activeBan = {
        id: 'ban-uuid-1',
        user_id: 10,
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
        where: { user_id: 10, unbanned_at: null },
        orderBy: { banned_at: 'desc' },
      });
      expect(mockPrisma.banHistory.update).toHaveBeenCalledWith({
        where: { id: 'ban-uuid-1' },
        data: {
          unbanned_at: expect.any(Date),
          unbanned_by_id: 1,
          unban_reason: 'Appeal approved',
        },
      });
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
    it('returns historical ban count for a user', async () => {
      mockPrisma.banHistory.count.mockResolvedValueOnce(3);

      const count = await service.getPreviousBansCount(10);

      expect(mockPrisma.banHistory.count).toHaveBeenCalledWith({
        where: { user_id: 10 },
      });
      expect(count).toBe(3);
    });
  });

  describe('getUserBanHistory', () => {
    it('returns chronological list of bans ordered desc', async () => {
      const historyList = [
        { id: 'ban-2', user_id: 10, banned_at: new Date('2026-11-04') },
        { id: 'ban-1', user_id: 10, banned_at: new Date('2026-10-01') },
      ];
      mockPrisma.banHistory.findMany.mockResolvedValueOnce(historyList);

      const result = await service.getUserBanHistory(10);

      expect(mockPrisma.banHistory.findMany).toHaveBeenCalledWith({
        where: { user_id: 10 },
        orderBy: { banned_at: 'desc' },
      });
      expect(result).toEqual(historyList);
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
});
