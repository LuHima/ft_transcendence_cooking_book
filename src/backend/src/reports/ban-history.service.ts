import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma, ReportReason } from '@prisma/client';
import { BanHistoryItemDto } from './dto/ban-history.dto';

export interface RecordBanParams {
  userId: number;
  bannedById: number;
  reason: ReportReason;
  description?: string | null;
  durationDays?: number | null;
  isPermanent?: boolean;
  reportId?: number | null;
  expiresAt?: Date | null;
}

@Injectable()
export class BanHistoryService {
  private readonly logger = new Logger(BanHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a new account ban in the immutable ban history ledger.
   */
  async recordBan(
    params: RecordBanParams,
    tx?: Prisma.TransactionClient,
  ): Promise<BanHistoryItemDto> {
    const client = tx ?? this.prisma;
    const isPermanent = params.isPermanent ?? false;

    const record = await client.banHistory.create({
      data: {
        user_id: params.userId,
        banned_by_id: params.bannedById,
        report_id: params.reportId ?? null,
        reason: params.reason,
        description: params.description ?? null,
        duration_days: isPermanent ? null : (params.durationDays ?? null),
        is_permanent: isPermanent,
        expires_at: params.expiresAt ?? null,
      },
    });

    this.logger.log(
      `Recorded ban event ${record.id} for user #${params.userId} by staff #${params.bannedById} (reason: ${params.reason})`,
    );

    return record;
  }

  /**
   * Record an unban event against the latest active ban record for a user.
   */
  async recordUnban(
    userId: number,
    staffId?: number | null,
    reason?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<BanHistoryItemDto | null> {
    const client = tx ?? this.prisma;

    const latestActiveBan = await client.banHistory.findFirst({
      where: {
        user_id: userId,
        unbanned_at: null,
      },
      orderBy: { banned_at: 'desc' },
    });

    if (!latestActiveBan) {
      return null;
    }

    const updated = await client.banHistory.update({
      where: { id: latestActiveBan.id },
      data: {
        unbanned_at: new Date(),
        unbanned_by_id: staffId ?? null,
        unban_reason: reason ?? null,
      },
    });

    this.logger.log(
      `Recorded unban event for ban ${updated.id} on user #${userId} by staff #${staffId ?? 'system'}`,
    );

    return updated;
  }

  /**
   * Retrieve total number of historical bans for a user to inform progressive discipline.
   */
  async getPreviousBansCount(
    userId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    return await client.banHistory.count({
      where: { user_id: userId },
    });
  }

  /**
   * Retrieve chronological ban history audit trail for a user.
   */
  async getUserBanHistory(
    userId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<BanHistoryItemDto[]> {
    const client = tx ?? this.prisma;
    return await client.banHistory.findMany({
      where: { user_id: userId },
      orderBy: { banned_at: 'desc' },
    });
  }

  /**
   * Compute progressive ban duration using doubling formula min(base * 2^previousBansCount, cap).
   */
  calculateProgressiveDuration(
    baseDuration: number,
    previousBansCount: number,
    cap = 180,
  ): number {
    const escalated = baseDuration * Math.pow(2, previousBansCount);
    return Math.min(escalated, cap);
  }

  /**
   * Retrieve the latest active or most recent ban entry for a user.
   */
  async getLatestActiveBan(
    userId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<BanHistoryItemDto | null> {
    const client = tx ?? this.prisma;
    return await client.banHistory.findFirst({
      where: { user_id: userId },
      orderBy: { banned_at: 'desc' },
    });
  }
}
