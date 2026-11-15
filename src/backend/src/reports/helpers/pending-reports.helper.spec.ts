import { ReportStatus, ReportSubject } from '@prisma/client';
import {
  getBatchReportMetrics,
  getPendingCommentReportTargetIds,
  getPendingReportTargetIds,
} from './pending-reports.helper';

describe('getPendingCommentReportTargetIds', () => {
  it('returns empty array when prisma or report table is undefined', async () => {
    expect(await getPendingCommentReportTargetIds(null)).toEqual([]);
    expect(await getPendingCommentReportTargetIds({})).toEqual([]);
  });

  it('queries prisma.report.findMany and returns unique target IDs', async () => {
    const mockPrisma = {
      report: {
        findMany: jest.fn().mockResolvedValue([
          { target_id: 10 },
          { target_id: 20 },
          { target_id: 10 },
        ]),
      },
    };

    const ids = await getPendingCommentReportTargetIds(mockPrisma);

    expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
      where: {
        subject: ReportSubject.comment,
        status: ReportStatus.pending,
      },
      select: { target_id: true },
    });
    expect(ids).toEqual([10, 20]);
  });

  it('handles query error gracefully and returns empty array', async () => {
    const mockPrisma = {
      report: {
        findMany: jest.fn().mockRejectedValue(new Error('DB error')),
      },
    };

    const ids = await getPendingCommentReportTargetIds(mockPrisma);
    expect(ids).toEqual([]);
  });
});

describe('getPendingReportTargetIds', () => {
  it('queries pending target IDs for the given ReportSubject', async () => {
    const mockPrisma = {
      report: {
        findMany: jest.fn().mockResolvedValue([{ target_id: 5 }, { target_id: 8 }]),
      },
    };

    const ids = await getPendingReportTargetIds(mockPrisma, ReportSubject.recipe);

    expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
      where: {
        subject: ReportSubject.recipe,
        status: ReportStatus.pending,
      },
      select: { target_id: true },
    });
    expect(ids).toEqual([5, 8]);
  });
});

describe('getBatchReportMetrics', () => {
  it('returns empty maps when targetIds is empty or prisma.report is missing', async () => {
    const empty = await getBatchReportMetrics(null, ReportSubject.recipe, [1]);
    expect(empty.total.size).toBe(0);
    expect(empty.pending.size).toBe(0);
    expect(empty.latestPendingId.size).toBe(0);

    const noIds = await getBatchReportMetrics(
      { report: { groupBy: jest.fn() } },
      ReportSubject.comment,
      [],
    );
    expect(noIds.total.size).toBe(0);
  });

  it('computes total (all statuses), pending, and deterministic latestPendingId', async () => {
    const mockPrisma = {
      report: {
        groupBy: jest.fn().mockResolvedValue([
          { target_id: 10, status: ReportStatus.pending, _count: { id: 2 } },
          { target_id: 10, status: ReportStatus.dismissed, _count: { id: 3 } },
          { target_id: 20, status: ReportStatus.action_taken, _count: { id: 4 } },
        ]),
        findMany: jest.fn().mockResolvedValue([
          // Ordered by created_at DESC, id DESC -> first per target_id wins
          { id: 105, target_id: 10 },
          { id: 101, target_id: 10 },
        ]),
      },
    };

    const metrics = await getBatchReportMetrics(
      mockPrisma,
      ReportSubject.comment,
      [10, 20, 10],
    );

    expect(mockPrisma.report.groupBy).toHaveBeenCalledWith({
      by: ['target_id', 'status'],
      where: {
        subject: ReportSubject.comment,
        target_id: { in: [10, 20] },
      },
      _count: { id: true },
    });
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith({
      where: {
        subject: ReportSubject.comment,
        status: ReportStatus.pending,
        target_id: { in: [10] },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      select: { id: true, target_id: true },
    });

    expect(metrics.total.get(10)).toBe(5);
    expect(metrics.pending.get(10)).toBe(2);
    expect(metrics.latestPendingId.get(10)).toBe(105);

    expect(metrics.total.get(20)).toBe(4);
    expect(metrics.pending.get(20)).toBeUndefined();
    expect(metrics.latestPendingId.get(20)).toBeUndefined();
  });
});
