import { ReportSubject, ReportStatus } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

/**
 * Retrieves the unique target IDs of all active pending comment reports.
 * Shared between RecipeService (role-scoped recipe triage) and AdminService (comment audit stream).
 */
export async function getPendingCommentReportTargetIds(
  prisma: Pick<PrismaService, 'report'> | any,
): Promise<number[]> {
  if (!prisma?.report?.findMany) {
    return [];
  }
  try {
    const pendingReports = await prisma.report.findMany({
      where: {
        subject: ReportSubject.comment,
        status: ReportStatus.pending,
      },
      select: { target_id: true },
    });
    return Array.from(
      new Set(pendingReports.map((r: { target_id: number }) => r.target_id)),
    );
  } catch {
    return [];
  }
}
