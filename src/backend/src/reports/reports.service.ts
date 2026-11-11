import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { RecipeService } from '../recipe/recipe.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto, ReportAction } from './dto/update-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import {
  ReportItemDto,
  PaginatedReportsResponseDto,
} from './dto/report-response.dto';
import {
  Prisma,
  ReportReason,
  ReportStatus,
  ReportSubject,
  Role,
  UserStatus,
} from '@prisma/client';
import { createHttpException, errors } from '../common/config/error.config';
import { BanHistoryService } from './ban-history.service';
import {
  getDefaultBanDuration,
  MAX_MODERATOR_BAN_DAYS,
} from './constants/ban-duration-policy.constant';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeService: RecipeService,
    private readonly banHistoryService: BanHistoryService,
  ) {}

  /**
   * Submit a content report against a recipe, comment, or user profile.
   */
  async createReport(
    reporterId: number,
    dto: CreateReportDto,
  ): Promise<ReportItemDto> {
    // 1. Verify that target resource exists
    if (dto.subject === ReportSubject.recipe) {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: dto.target_id },
        select: { id: true },
      });
      if (!recipe) {
        throw new NotFoundException('Target item not found');
      }
    } else if (dto.subject === ReportSubject.comment) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: dto.target_id },
        select: { id: true },
      });
      if (!comment) {
        throw new NotFoundException('Target item not found');
      }
    } else if (dto.subject === ReportSubject.user) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.target_id, deleted_at: null },
        select: { id: true },
      });
      if (!user) {
        throw new NotFoundException('Target item not found');
      }
    }

    // 2. Duplicate check: reject if reporter already has a pending report on the same target
    const existingPendingReport = await this.prisma.report.findFirst({
      where: {
        reporter_id: reporterId,
        subject: dto.subject,
        target_id: dto.target_id,
        status: ReportStatus.pending,
      },
    });
    if (existingPendingReport) {
      throw new ConflictException(
        'A pending report already exists for this item',
      );
    }

    // 3. Create report
    const created = await this.prisma.report.create({
      data: {
        reporter_id: reporterId,
        subject: dto.subject,
        target_id: dto.target_id,
        reason: dto.reason,
        description: dto.description?.trim() || null,
      },
    });

    return {
      ...created,
      previous_bans_count: 0,
    };
  }

  /**
   * Retrieve paginated content reports with optional status and subject filtering,
   * hydrated with previous_bans_count for repeat offender tracking.
   */
  async getReports(
    query: ReportQueryDto,
  ): Promise<PaginatedReportsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ReportWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.subject ? { subject: query.subject } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ]);

    // Hydrate previous_bans_count, reporter, and polymorphic target via batched queries
    const reporterIds = Array.from(new Set(items.map((r) => r.reporter_id)));
    const targetUserIds = Array.from(
      new Set(
        items
          .filter((r) => r.subject === ReportSubject.user)
          .map((r) => r.target_id),
      ),
    );
    const targetRecipeIds = Array.from(
      new Set(
        items
          .filter((r) => r.subject === ReportSubject.recipe)
          .map((r) => r.target_id),
      ),
    );
    const targetCommentIds = Array.from(
      new Set(
        items
          .filter((r) => r.subject === ReportSubject.comment)
          .map((r) => r.target_id),
      ),
    );

    const [reporters, targetUsers, targetRecipes, targetComments] =
      await Promise.all([
        reporterIds.length > 0 && this.prisma.user?.findMany
          ? this.prisma.user.findMany({
              where: { id: { in: reporterIds } },
              select: { id: true, username: true, avatar_url: true },
            })
          : Promise.resolve([]),
        targetUserIds.length > 0 && this.prisma.user?.findMany
          ? this.prisma.user.findMany({
              where: { id: { in: targetUserIds } },
              select: { id: true, username: true, avatar_url: true },
            })
          : Promise.resolve([]),
        targetRecipeIds.length > 0 && this.prisma.recipe?.findMany
          ? this.prisma.recipe.findMany({
              where: { id: { in: targetRecipeIds } },
              select: {
                id: true,
                user_id: true,
                source_lang: true,
                translations: { select: { locale: true, title: true } },
                user: {
                  select: { id: true, username: true, avatar_url: true },
                },
              },
            })
          : Promise.resolve([]),
        targetCommentIds.length > 0 && this.prisma.comment?.findMany
          ? this.prisma.comment.findMany({
              where: { id: { in: targetCommentIds } },
              select: {
                id: true,
                content: true,
                recipe_id: true,
                user_id: true,
                user: {
                  select: { id: true, username: true, avatar_url: true },
                },
              },
            })
          : Promise.resolve([]),
      ]);

    const reporterMap = new Map<
      number,
      { id: number; username: string; avatar_url: string | null }
    >();
    for (const u of reporters || []) {
      reporterMap.set(u.id, u);
    }

    const targetUserMap = new Map<
      number,
      { id: number; username: string; avatar_url: string | null }
    >();
    for (const u of targetUsers || []) {
      targetUserMap.set(u.id, u);
    }

    const targetRecipeMap = new Map<number, (typeof targetRecipes)[0]>();
    for (const r of targetRecipes || []) {
      targetRecipeMap.set(r.id, r);
    }

    const targetCommentMap = new Map<number, (typeof targetComments)[0]>();
    for (const c of targetComments || []) {
      targetCommentMap.set(c.id, c);
    }

    const allTargetUserIds = Array.from(
      new Set(
        items
          .map((report) => {
            if (report.subject === ReportSubject.user) {
              return report.target_id;
            }
            if (report.subject === ReportSubject.recipe) {
              const r = targetRecipeMap.get(report.target_id);
              return r?.user_id ?? r?.user?.id ?? null;
            }
            if (report.subject === ReportSubject.comment) {
              const c = targetCommentMap.get(report.target_id);
              return c?.user_id ?? c?.user?.id ?? null;
            }
            return null;
          })
          .filter((id): id is number => id !== null),
      ),
    );

    const banCountsMap = new Map<number, number>();
    if (allTargetUserIds.length > 0 && this.prisma.banHistory?.groupBy) {
      try {
        const banGroups = await this.prisma.banHistory.groupBy({
          by: ['user_id'],
          _count: { id: true },
          where: { user_id: { in: allTargetUserIds } },
        });
        if (Array.isArray(banGroups)) {
          for (const bg of banGroups as any[]) {
            const cnt =
              typeof bg._count === 'number'
                ? bg._count
                : (bg._count?.id ?? 0);
            banCountsMap.set(bg.user_id, cnt);
          }
        }
      } catch {
        // Fallback for mocked environments
      }
    }

    const hydratedItems: ReportItemDto[] = await Promise.all(
      items.map(async (report) => {
        let reporter = (report as any).reporter;
        if (!reporter) {
          const u = reporterMap.get(report.reporter_id);
          reporter = u ?? {
            id: report.reporter_id,
            username: `user_${report.reporter_id}`,
            avatar_url: null,
          };
        }

        let targetUserId: number | null = null;
        let target: {
          label: string;
          recipe_id?: number;
          owner?: {
            id: number;
            username: string;
            avatar_url: string | null;
          } | null;
        } = { label: '' };

        if (report.subject === ReportSubject.user) {
          targetUserId = report.target_id;
          const u = targetUserMap.get(report.target_id);
          const username = u?.username ?? `user_${report.target_id}`;
          target = {
            label: username,
            owner: {
              id: u?.id ?? report.target_id,
              username,
              avatar_url: u?.avatar_url ?? null,
            },
          };
        } else if (report.subject === ReportSubject.recipe) {
          const r = targetRecipeMap.get(report.target_id);
          targetUserId = r?.user_id ?? r?.user?.id ?? null;

          // 4-tier localization fallback:
          // 1. Translation matching query.lang
          // 2. Author's declared source_lang
          // 3. English fallback ('en')
          // 4. First available translation, or 'Recipe #{id}'
          let title: string | undefined;
          if (query?.lang) {
            title = r?.translations?.find(
              (t) => t.locale === query.lang,
            )?.title;
          }
          if (!title && r?.source_lang) {
            title = r?.translations?.find(
              (t) => t.locale === r.source_lang,
            )?.title;
          }
          if (!title) {
            title = r?.translations?.find((t) => t.locale === 'en')?.title;
          }
          if (!title) {
            title = r?.translations?.[0]?.title;
          }
          if (!title) {
            title = `Recipe #${report.target_id}`;
          }

          target = {
            label: title,
            recipe_id: report.target_id,
            owner: r?.user
              ? {
                  id: r.user.id,
                  username: r.user.username,
                  avatar_url: r.user.avatar_url ?? null,
                }
              : null,
          };
        } else if (report.subject === ReportSubject.comment) {
          const c = targetCommentMap.get(report.target_id);
          targetUserId = c?.user_id ?? c?.user?.id ?? null;
          target = {
            label: c?.content ?? `Comment #${report.target_id}`,
            recipe_id: c?.recipe_id,
            owner: c?.user
              ? {
                  id: c.user.id,
                  username: c.user.username,
                  avatar_url: c.user.avatar_url ?? null,
                }
              : null,
          };
        }

        let count =
          targetUserId !== null ? banCountsMap.get(targetUserId) : 0;
        if (
          count === undefined &&
          targetUserId !== null &&
          this.banHistoryService?.getPreviousBansCount
        ) {
          count = await this.banHistoryService.getPreviousBansCount(targetUserId);
        }

        return {
          ...report,
          reporter,
          target,
          previous_bans_count: count ?? 0,
        };
      }),
    );

    const total_pages = Math.ceil(total / limit) || 1;

    return {
      items: hydratedItems,
      total,
      page,
      limit,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    };
  }

  /**
   * Update report status, execute composite resolution actions atomically,
   * apply content takedown or user bans, evict active sessions, record ban history,
   * and store dual rationale (user-facing explanation vs internal audit notes).
   */
  async updateReport(
    reportId: number,
    dto: UpdateReportDto,
    caller?: number | { id: number; role?: Role | string },
  ): Promise<ReportItemDto> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const callerRole = typeof caller === 'object' ? caller.role : undefined;
    const callerId = typeof caller === 'number' ? caller : caller?.id;

    // Normalize resolution actions: supports actions array as well as legacy resolution/action string
    let actions: ReportAction[] = [];
    if (dto.actions && dto.actions.length > 0) {
      actions = [...dto.actions];
    } else if (dto.resolution || dto.action) {
      const legacy = (dto.resolution || dto.action) as ReportAction;
      if (Object.values(ReportAction).includes(legacy)) {
        actions = [legacy];
      }
    }

    // Automatically resolve status if not explicitly passed
    let targetStatus = dto.status;
    if (!targetStatus) {
      if (actions.includes(ReportAction.dismiss)) {
        targetStatus = ReportStatus.dismissed;
      } else if (actions.length > 0) {
        targetStatus = ReportStatus.action_taken;
      } else {
        targetStatus = report.status;
      }
    }

    const effectiveReason = dto.resolution_reason ?? report.reason;

    return await this.prisma.$transaction(async (tx) => {
      let resolvedTargetUserId: number | null = null;

      // Handle actions that require target author / content resolution
      if (
        actions.includes(ReportAction.delete_content) ||
        actions.includes(ReportAction.ban)
      ) {
        let targetAuthorRole: Role | undefined;

        if (report.subject === ReportSubject.recipe) {
          const recipe = await tx.recipe.findUnique({
            where: { id: report.target_id },
            include: { user: { select: { id: true, role: true } } },
          });
          if (!recipe) {
            throw new NotFoundException('Target recipe not found');
          }
          resolvedTargetUserId = recipe.user_id;
          targetAuthorRole = recipe.user?.role;
        } else if (report.subject === ReportSubject.comment) {
          const comment = await tx.comment.findUnique({
            where: { id: report.target_id },
            include: { user: { select: { id: true, role: true } } },
          });
          if (!comment) {
            throw new NotFoundException('Target comment not found');
          }
          resolvedTargetUserId = comment.user_id;
          targetAuthorRole = comment.user?.role;
        } else if (report.subject === ReportSubject.user) {
          const user = await tx.user.findFirst({
            where: { id: report.target_id, deleted_at: null },
            select: { id: true, role: true },
          });
          if (!user) {
            throw new NotFoundException('Target user not found');
          }
          resolvedTargetUserId = user.id;
          targetAuthorRole = user.role;
        }

        // Role hierarchy safeguard: Moderator cannot moderate or ban Administrator
        if (callerRole === Role.moderator && targetAuthorRole === Role.admin) {
          if (actions.includes(ReportAction.delete_content)) {
            throw createHttpException(
              errors.common.forbidden,
              'Moderators cannot moderate or delete administrator content',
            );
          }
          if (actions.includes(ReportAction.ban)) {
            throw createHttpException(
              errors.moderation.cannotBanAdmin,
              'Moderators cannot moderate or ban administrator',
            );
          }
        }

        // Content Deactivation Action
        if (actions.includes(ReportAction.delete_content)) {
          if (report.subject === ReportSubject.recipe) {
            await tx.recipe.update({
              where: { id: report.target_id },
              data: { is_active: false },
            });
            this.logger.log(
              `Audit: Report #${reportId} resolved with delete_content. Recipe #${report.target_id} suspended.`,
            );
          } else if (report.subject === ReportSubject.comment) {
            await tx.comment.update({
              where: { id: report.target_id },
              data: { is_active: false },
            });
            this.logger.log(
              `Audit: Report #${reportId} resolved with delete_content. Comment #${report.target_id} deactivated.`,
            );
          }
        }

        // Account Ban Action
        if (actions.includes(ReportAction.ban)) {
          const isPermanent = Boolean(dto.is_permanent);

          // Moderator Cap Enforcement: maximum 180 days, no permanent bans
          if (callerRole === Role.moderator) {
            if (isPermanent) {
              throw createHttpException(
                errors.moderation.banCapExceeded,
                'Moderators cannot issue permanent bans',
              );
            }
            if (
              dto.ban_duration_days &&
              dto.ban_duration_days > MAX_MODERATOR_BAN_DAYS
            ) {
              throw createHttpException(
                errors.moderation.banCapExceeded,
                'Ban duration cannot exceed 180 days for moderators',
              );
            }
          }

          // Calculate duration and expiration
          let durationDays: number | null = null;
          let bannedUntil: Date | null = null;

          if (!isPermanent) {
            durationDays =
              dto.ban_duration_days ?? getDefaultBanDuration(effectiveReason);
            bannedUntil = new Date(Date.now() + durationDays * 86400000);
          }

          if (resolvedTargetUserId) {
            // Update user status and expiration
            await tx.user.update({
              where: { id: resolvedTargetUserId },
              data: {
                status: UserStatus.banned,
                banned_until: bannedUntil,
              },
            });

            // Suspend all active recipes authored by the banned user
            await tx.recipe.updateMany({
              where: { user_id: resolvedTargetUserId, is_active: true },
              data: { is_active: false },
            });

            // Evict active JWT sessions
            await tx.jwtSession.deleteMany({
              where: { id_user: resolvedTargetUserId },
            });

            // Record in immutable BanHistory ledger
            await this.banHistoryService.recordBan(
              {
                userId: resolvedTargetUserId,
                bannedById: callerId ?? 0,
                reason: effectiveReason,
                description: dto.resolution_description ?? null,
                durationDays,
                isPermanent,
                reportId: report.id,
                expiresAt: bannedUntil,
              },
              tx,
            );

            this.logger.log(
              `Audit: Report #${reportId} resolved with ban. User #${resolvedTargetUserId} banned (duration: ${durationDays ?? 'permanent'} days).`,
            );
          }
        }
      }

      // Update report record
      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: targetStatus,
          resolution_reason: effectiveReason,
          resolution_description: dto.resolution_description?.trim() || null,
          resolution_notes:
            dto.resolution_notes !== undefined
              ? dto.resolution_notes.trim() || null
              : undefined,
          ...(callerId
            ? {
                resolved_by_id: callerId,
                resolved_at: new Date(),
              }
            : {}),
        },
      });

      const previousBansCount = resolvedTargetUserId
        ? await this.banHistoryService.getPreviousBansCount(
            resolvedTargetUserId,
            tx,
          )
        : 0;

      return {
        ...updatedReport,
        previous_bans_count: previousBansCount,
      };
    });
  }
}
