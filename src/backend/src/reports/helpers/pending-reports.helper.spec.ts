import { ReportStatus, ReportSubject } from '@prisma/client';
import { getPendingCommentReportTargetIds } from './pending-reports.helper';

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
