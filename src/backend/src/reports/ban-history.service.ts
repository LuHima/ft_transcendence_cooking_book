import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, ReportAction, ReportReason } from '@prisma/client';
import {
  BanHistoryItemDto,
  BanHistoryQueryDto,
  PaginatedBanHistoryResponseDto,
} from './dto/ban-history.dto';
import { buildPaginatedResponse } from '../common/dto/pagination-query.dto';
import { SortOrder } from '../common/dto/sort-order.enum';

export interface RecordBanParams {
  userId: number;
  bannedById: number;
  reason: ReportReason;
  action?: ReportAction;
  description?: string | null;
  internalNotes?: string | null;
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
   * Record a new disciplinary sanction (warning or suspension) in the immutable history ledger.
   */
  async recordSanction(
    params: RecordBanParams,
    tx?: Prisma.TransactionClient,
  ): Promise<BanHistoryItemDto> {
    const client = tx ?? this.prisma;
    const action = params.action ?? ReportAction.ban;
    const isWarn = action === ReportAction.warn;
    const isPermanent = isWarn ? false : (params.isPermanent ?? false);

    const record = await client.banHistory.create({
      data: {
        user_id: params.userId,
        banned_by_id: params.bannedById,
        report_id: params.reportId ?? null,
        action,
        reason: params.reason,
        description: params.description ?? null,
        internal_notes: params.internalNotes?.trim() || null,
        duration_days:
          isWarn || isPermanent ? null : (params.durationDays ?? null),
        is_permanent: isPermanent,
        expires_at: isWarn ? null : (params.expiresAt ?? null),
      },
    });

    this.logger.log(
      `Recorded ${action} sanction event ${record.id} for user #${params.userId} by staff #${params.bannedById} (reason: ${params.reason})`,
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
        action: ReportAction.ban,
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

    if (client.banHistory.updateMany) {
      await client.banHistory.updateMany({
        where: {
          user_id: userId,
          action: ReportAction.ban,
          unbanned_at: null,
          id: { not: updated.id },
        },
        data: {
          unbanned_at: new Date(),
          unbanned_by_id: staffId ?? null,
          unban_reason: reason ?? null,
        },
      });
    }

    this.logger.log(
      `Recorded unban event for ban ${updated.id} on user #${userId} by staff #${staffId ?? 'system'}`,
    );

    return updated;
  }

  /**
   * Close all open ban records for a user (e.g., on disable, soft-delete, or superseding ban).
   */
  async closeOpenBans(
    userId: number,
    staffId?: number | null,
    reason?: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;

    const result = await client.banHistory.updateMany({
      where: {
        user_id: userId,
        action: ReportAction.ban,
        unbanned_at: null,
      },
      data: {
        unbanned_at: new Date(),
        unbanned_by_id: staffId ?? null,
        unban_reason: reason ?? null,
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Closed ${result.count} open ban(s) for user #${userId} by staff #${staffId ?? 'system'} (reason: ${reason ?? 'none'})`,
      );
    }

    return result.count;
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
      where: {
        user_id: userId,
        action: ReportAction.ban,
      },
    });
  }

  /**
   * Retrieve total number of historical warnings for a user.
   */
  async getPreviousWarningsCount(
    userId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    return await client.banHistory.count({
      where: {
        user_id: userId,
        action: ReportAction.warn,
      },
    });
  }

  /**
   * Retrieve paginated chronological ban and warning sanctions history audit trail for a user.
   */
  async getUserSanctionsHistory(
    userId: number,
    query: BanHistoryQueryDto = {},
    tx?: Prisma.TransactionClient,
  ): Promise<PaginatedBanHistoryResponseDto> {
    const client = tx ?? this.prisma;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortOrder = query.sort_order ?? SortOrder.desc;
    const where = { user_id: userId };

    const [items, total] = await Promise.all([
      client.banHistory.findMany({
        where,
        orderBy: { banned_at: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          banned_by: {
            select: { id: true, username: true, avatar_url: true },
          },
          unbanned_by: {
            select: { id: true, username: true, avatar_url: true },
          },
        },
      }),
      client.banHistory.count({ where }),
    ]);

    const hydratedItems: BanHistoryItemDto[] = items.map((item) => ({
      ...item,
      banned_by: item.banned_by ?? null,
      unbanned_by: item.unbanned_by ?? null,
    }));

    return buildPaginatedResponse(hydratedItems, total, page, limit);
  }

  /**
   * Advisory helper for staff: compute suggested progressive ban duration using
   * doubling formula min(base * 2^previousBansCount, cap).
   * Staff retain full discretionary choice over actual ban duration.
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
      where: {
        user_id: userId,
        action: ReportAction.ban,
      },
      orderBy: { banned_at: 'desc' },
    });
  }
}
