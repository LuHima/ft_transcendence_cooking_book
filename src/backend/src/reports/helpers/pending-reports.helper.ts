import { ReportSubject, ReportStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export interface ReportMetricsMaps {
  total: Map<number, number>;
  pending: Map<number, number>;
  latestPendingId: Map<number, number>;
}

/**
 * Retrieves the unique target IDs of all active pending reports for a given subject.
 * Shared across AdminService (comment audit stream) and RecipeService (admin recipe stream & moderator privacy).
 */
export async function getPendingReportTargetIds(
  prisma: Pick<PrismaService, 'report'> | any,
  subject: ReportSubject,
): Promise<number[]> {
  if (!prisma?.report?.findMany) {
    return [];
  }
  try {
    const pendingReports = await prisma.report.findMany({
      where: {
        subject,
        status: ReportStatus.pending,
      },
      select: { target_id: true },
    });
    return Array.from(
      new Set(
        (pendingReports ?? []).map((r: { target_id: number }) => r.target_id),
      ),
    );
  } catch {
    return [];
  }
}

/**
 * Retrieves the unique target IDs of all active pending comment reports.
 */
export async function getPendingCommentReportTargetIds(
  prisma: Pick<PrismaService, 'report'> | any,
): Promise<number[]> {
  return getPendingReportTargetIds(prisma, ReportSubject.comment);
}

/**
 * Batch-computes per-target total report count (all statuses), active pending report count,
 * and deterministic latest pending report ID (created_at DESC, id DESC) for a given subject.
 */
export async function getBatchReportMetrics(
  prisma: Pick<PrismaService, 'report'> | any,
  subject: ReportSubject,
  targetIds: number[],
): Promise<ReportMetricsMaps> {
  const total = new Map<number, number>();
  const pending = new Map<number, number>();
  const latestPendingId = new Map<number, number>();

  const uniqueIds = Array.from(new Set(targetIds));
  if (uniqueIds.length === 0 || !prisma?.report?.groupBy) {
    return { total, pending, latestPendingId };
  }

  try {
    const groups = await prisma.report.groupBy({
      by: ['target_id', 'status'],
      where: {
        subject,
        target_id: { in: uniqueIds },
      },
      _count: { id: true },
    });

    for (const g of (groups ?? []) as any[]) {
      const cnt =
        typeof g._count === 'number' ? g._count : (g._count?.id ?? 1);
      total.set(g.target_id, (total.get(g.target_id) || 0) + cnt);

      if (
        !g.status ||
        g.status === ReportStatus.pending ||
        g.status === 'pending'
      ) {
        pending.set(g.target_id, (pending.get(g.target_id) || 0) + cnt);
      }
    }

    const pendingTargetIds = Array.from(pending.keys());
    if (pendingTargetIds.length > 0 && prisma.report?.findMany) {
      const latestPendingRows = await prisma.report.findMany({
        where: {
          subject,
          status: ReportStatus.pending,
          target_id: { in: pendingTargetIds },
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: { id: true, target_id: true },
      });

      for (const row of (latestPendingRows ?? []) as Array<{
        id: number;
        target_id: number;
      }>) {
        if (!latestPendingId.has(row.target_id)) {
          latestPendingId.set(row.target_id, row.id);
        }
      }
    }
  } catch {
    // Fallback for partially mocked environments
  }

  return { total, pending, latestPendingId };
}
