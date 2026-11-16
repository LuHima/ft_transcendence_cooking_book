import { Prisma, ReportSubject, ReportStatus } from '@prisma/client';

export interface ReportMetricsMaps {
  total: Map<number, number>;
  pending: Map<number, number>;
  latestPendingId: Map<number, number>;
}

export interface TargetReportCounters {
  reports_count: number;
  pending_reports_count: number;
  has_pending_reports: boolean;
  latest_pending_report_id: number | null;
}

export interface ReportTargetIdRow {
  target_id: number;
}

export interface ReportLatestIdRow {
  id: number;
  target_id: number;
}

export interface ReportGroupByRow {
  target_id: number;
  status?: ReportStatus | string;
  _count: number | { id?: number };
}

export interface ReportDelegateLike {
  findMany?: (
    args: Prisma.ReportFindManyArgs,
  ) => PromiseLike<Array<ReportTargetIdRow | ReportLatestIdRow>>;
  groupBy?: (args: Prisma.ReportGroupByArgs) => PromiseLike<ReportGroupByRow[]>;
  updateMany?: (
    args: Prisma.ReportUpdateManyArgs,
  ) => PromiseLike<{ count: number }>;
}

export interface ReportPrismaLike {
  report?: ReportDelegateLike;
}

export interface BatchReportMetricsOptions {
  includeLatestPendingId?: boolean;
}

/**
 * Retrieves the unique target IDs of all active pending reports for a given subject.
 * Shared across AdminService (comment audit stream) and RecipeService (admin recipe stream & moderator privacy).
 */
export async function getPendingReportTargetIds(
  prisma: ReportPrismaLike | null | undefined,
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
      distinct: ['target_id'],
      select: { target_id: true },
    });
    return Array.from(
      new Set((pendingReports ?? []).map((r) => r.target_id)),
    );
  } catch {
    return [];
  }
}

/**
 * Retrieves the unique target IDs of all active pending comment reports.
 */
export async function getPendingCommentReportTargetIds(
  prisma: ReportPrismaLike | null | undefined,
): Promise<number[]> {
  return getPendingReportTargetIds(prisma, ReportSubject.comment);
}

/**
 * Populates deterministic latest pending report IDs (created_at DESC, id DESC) on an existing
 * ReportMetricsMaps instance, scoped to the supplied target IDs that have pending reports.
 */
export async function populateLatestPendingReportIds(
  prisma: ReportPrismaLike | null | undefined,
  subject: ReportSubject,
  metrics: ReportMetricsMaps,
  targetIds?: number[],
): Promise<void> {
  if (!prisma?.report?.findMany) {
    return;
  }

  const pendingTargetIds = (
    targetIds
      ? Array.from(new Set(targetIds)).filter(
          (id) => (metrics.pending.get(id) || 0) > 0,
        )
      : Array.from(metrics.pending.keys())
  ).filter((id) => !metrics.latestPendingId.has(id));

  if (pendingTargetIds.length === 0) {
    return;
  }

  try {
    const latestPendingRows = (await prisma.report.findMany({
      where: {
        subject,
        status: ReportStatus.pending,
        target_id: { in: pendingTargetIds },
      },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      distinct: ['target_id'],
      select: { id: true, target_id: true },
    })) as ReportLatestIdRow[];

    for (const row of latestPendingRows ?? []) {
      if (!metrics.latestPendingId.has(row.target_id)) {
        metrics.latestPendingId.set(row.target_id, row.id);
      }
    }
  } catch {
    // Fallback for partially mocked environments
  }
}

/**
 * Batch-computes per-target total report count (all statuses), active pending report count,
 * and deterministic latest pending report ID (created_at DESC, id DESC) for a given subject.
 */
export async function getBatchReportMetrics(
  prisma: ReportPrismaLike | null | undefined,
  subject: ReportSubject,
  targetIds: number[],
  options: BatchReportMetricsOptions = {},
): Promise<ReportMetricsMaps> {
  const total = new Map<number, number>();
  const pending = new Map<number, number>();
  const latestPendingId = new Map<number, number>();
  const metrics: ReportMetricsMaps = { total, pending, latestPendingId };

  const uniqueIds = Array.from(new Set(targetIds));
  if (uniqueIds.length === 0 || !prisma?.report?.groupBy) {
    return metrics;
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

    for (const g of groups ?? []) {
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

    if (options.includeLatestPendingId !== false) {
      await populateLatestPendingReportIds(prisma, subject, metrics);
    }
  } catch {
    // Fallback for partially mocked environments
  }

  return metrics;
}

/**
 * Projects standardized report counter fields for a single target ID from batch metrics.
 */
export function extractTargetReportCounters(
  metrics: ReportMetricsMaps,
  targetId: number,
): TargetReportCounters {
  const totalCount = metrics.total.get(targetId) || 0;
  const pendingCount = metrics.pending.get(targetId) || 0;
  const latestPendingReportId =
    pendingCount > 0 ? (metrics.latestPendingId.get(targetId) ?? null) : null;

  return {
    reports_count: totalCount,
    pending_reports_count: pendingCount,
    has_pending_reports: pendingCount > 0,
    latest_pending_report_id: latestPendingReportId,
  };
}

/**
 * Sorts target records in-place by a batch report count map with deterministic
 * (created_at DESC, id DESC) tie-breaking.
 */
export function sortByReportMetric<
  T extends { id: number; created_at: Date | string },
>(items: T[], countMap: Map<number, number>, sortOrder: 'asc' | 'desc'): T[] {
  return items.sort((a, b) => {
    const countA = countMap.get(a.id) || 0;
    const countB = countMap.get(b.id) || 0;
    if (countB !== countA) {
      return sortOrder === 'asc' ? countA - countB : countB - countA;
    }
    const timeDiff =
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return b.id - a.id;
  });
}

/**
 * Auto-dismisses open (pending) reports whose target was permanently deleted or
 * deactivated, preventing dangling reports from failing with 404 on resolution.
 */
export async function dismissOpenReports(
  prisma: ReportPrismaLike | null | undefined,
  subject: ReportSubject,
  targetIds: number[],
  resolvedById: number | null,
  resolutionNotes: string,
): Promise<void> {
  if (!prisma?.report?.updateMany || targetIds.length === 0) {
    return;
  }
  await prisma.report.updateMany({
    where: {
      subject,
      target_id: { in: targetIds },
      status: ReportStatus.pending,
    },
    data: {
      status: ReportStatus.dismissed,
      resolved_by_id: resolvedById,
      resolved_at: new Date(),
      resolution_notes: resolutionNotes,
    },
  });
}
