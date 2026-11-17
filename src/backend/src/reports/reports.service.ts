import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';
import { RecipeService } from '../recipe/recipe.service';
import { RecipeProjection } from '../recipe/recipe.projection';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto, ReportAction } from './dto/update-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { buildPaginatedResponse } from '../common/dto/pagination-query.dto';
import {
  ReportItemDto,
  PaginatedReportsResponseDto,
} from './dto/report-response.dto';
import {
  NotificationAction,
  NotificationSubject,
  Prisma,
  ReportReason,
  ReportStatus,
  ReportSubject,
  Role,
  UserStatus,
} from '@prisma/client';
import { NotificationEmit } from '../notifications/notification-emit';
import {
  USER_EVICT_EVENT,
  type UserEvictEventPayload,
} from '../notifications/notification-events';
import { createHttpException, errors } from '../common/config/error.config';
import { BanHistoryService } from './ban-history.service';
import {
  getDefaultBanDuration,
  MAX_MODERATOR_BAN_DAYS,
} from './constants/ban-duration-policy.constant';
import { validateReportActions } from './helpers/report-actions.validator';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeService: RecipeService,
    private readonly banHistoryService: BanHistoryService,
    private readonly notificationEmit: NotificationEmit,
    private readonly recipeProjection: RecipeProjection,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Submit a content report against a recipe, comment, or user profile.
   */
  async createReport(
    reporterId: number,
    dto: CreateReportDto,
  ): Promise<ReportItemDto> {
    // 1. Verify that target resource exists and is not owned by the reporter
    if (dto.subject === ReportSubject.recipe) {
      const recipe = await this.prisma.recipe.findUnique({
        where: { id: dto.target_id },
        select: { id: true, user_id: true },
      });
      if (!recipe) {
        throw new NotFoundException('Target item not found');
      }
      if (recipe.user_id === reporterId) {
        throw new BadRequestException('You cannot report your own recipe');
      }
    } else if (dto.subject === ReportSubject.comment) {
      const comment = await this.prisma.comment.findUnique({
        where: { id: dto.target_id },
        select: { id: true, user_id: true },
      });
      if (!comment) {
        throw new NotFoundException('Target item not found');
      }
      if (comment.user_id === reporterId) {
        throw new BadRequestException('You cannot report your own comment');
      }
    } else if (dto.subject === ReportSubject.user) {
      if (dto.target_id === reporterId) {
        throw new BadRequestException('You cannot report yourself');
      }
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
    let created;
    try {
      created = await this.prisma.report.create({
        data: {
          reporter_id: reporterId,
          subject: dto.subject,
          target_id: dto.target_id,
          reason: dto.reason,
          description: dto.description?.trim() || null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A pending report already exists for this item',
        );
      }
      throw error;
    }

    return {
      ...created,
      actions: created.actions ?? [],
      previous_bans_count: 0,
      previous_warnings_count: 0,
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
      ...(query.target_id !== undefined ? { target_id: query.target_id } : {}),
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

    // Hydrate previous_bans_count, reporter, resolved_by, and polymorphic target via batched queries
    const hydratedItems = await this.hydrateReportItems(
      items,
      query?.lang ?? '',
    );

    return buildPaginatedResponse(hydratedItems, total, page, limit);
  }

  /**
   * Retrieve a single content report by ID, hydrated with reporter, resolved_by,
   * polymorphic target summary, and prior sanction counts.
   */
  async getReportById(reportId: number, lang = ''): Promise<ReportItemDto> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    const [hydrated] = await this.hydrateReportItems([report], lang);
    return hydrated;
  }

  /**
   * Batch-hydrate reporter, resolved_by, polymorphic target, and optional sanction counts
   * for one or more report records.
   */
  private async hydrateReportItems(
    items: any[],
    lang = '',
    options: { skipSanctionCounts?: boolean } = {},
  ): Promise<ReportItemDto[]> {
    if (items.length === 0) {
      return [];
    }

    const reporterIds = Array.from(
      new Set(
        items
          .map((r) => r.reporter_id)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    const resolvedByIds = Array.from(
      new Set(
        items
          .map((r) => r.resolved_by_id)
          .filter((id): id is number => typeof id === 'number'),
      ),
    );
    const targetUserIds = Array.from(
      new Set(
        items
          .filter(
            (r) =>
              r.subject === ReportSubject.user &&
              typeof r.target_id === 'number',
          )
          .map((r) => r.target_id),
      ),
    );
    const targetRecipeIds = Array.from(
      new Set(
        items
          .filter(
            (r) =>
              r.subject === ReportSubject.recipe &&
              typeof r.target_id === 'number',
          )
          .map((r) => r.target_id),
      ),
    );
    const targetCommentIds = Array.from(
      new Set(
        items
          .filter(
            (r) =>
              r.subject === ReportSubject.comment &&
              typeof r.target_id === 'number',
          )
          .map((r) => r.target_id),
      ),
    );

    const actorUserIds = Array.from(
      new Set([...reporterIds, ...resolvedByIds]),
    );

    const [actorUsers, targetUsers, targetRecipes, targetComments] =
      await Promise.all([
        actorUserIds.length > 0 && this.prisma.user?.findMany
          ? this.prisma.user.findMany({
              where: { id: { in: actorUserIds } },
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

    const actorUserMap = new Map<
      number,
      { id: number; username: string; avatar_url: string | null }
    >();
    for (const u of actorUsers || []) {
      actorUserMap.set(u.id, u);
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

    const allTargetUserIds = !options.skipSanctionCounts
      ? Array.from(
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
        )
      : [];

    const sanctionCountsMap =
      allTargetUserIds.length > 0
        ? ((await this.banHistoryService?.getSanctionCountsMap?.(
            allTargetUserIds,
          )) ?? null)
        : new Map<number, { bans: number; warnings: number }>();
    const ranBanBatch = sanctionCountsMap !== null;

    return await Promise.all(
      items.map(async (report) => {
        let reporter = report.reporter;
        if (!reporter && typeof report.reporter_id === 'number') {
          const u = actorUserMap.get(report.reporter_id);
          reporter = u ?? {
            id: report.reporter_id,
            username: `user_${report.reporter_id}`,
            avatar_url: null,
          };
        }

        const resolved_by =
          report.resolved_by !== undefined
            ? report.resolved_by
            : typeof report.resolved_by_id === 'number'
              ? (actorUserMap.get(report.resolved_by_id) ?? null)
              : null;

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

          const resolvedTrans = r?.translations
            ? this.recipeProjection.resolveTranslation(
                r.translations,
                lang,
                r.source_lang,
              )
            : undefined;
          const title = resolvedTrans?.title || `Recipe #${report.target_id}`;

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

        let banCount = report.previous_bans_count ?? 0;
        let warningCount = report.previous_warnings_count ?? 0;
        if (!options.skipSanctionCounts && targetUserId !== null) {
          if (ranBanBatch) {
            const counts = sanctionCountsMap.get(targetUserId);
            banCount = counts?.bans ?? 0;
            warningCount = counts?.warnings ?? 0;
          } else {
            if (this.banHistoryService?.getPreviousBansCount) {
              banCount =
                await this.banHistoryService.getPreviousBansCount(targetUserId);
            }
            if (this.banHistoryService?.getPreviousWarningsCount) {
              warningCount =
                await this.banHistoryService.getPreviousWarningsCount(
                  targetUserId,
                );
            }
          }
        }

        return {
          ...report,
          actions: report.actions ?? [],
          reporter: reporter ?? null,
          resolved_by,
          target,
          previous_bans_count: banCount,
          previous_warnings_count: warningCount,
        };
      }),
    );
  }

  private resolveTargetStatus(
    dto: UpdateReportDto,
    currentStatus: ReportStatus,
    actions: ReportAction[],
  ): ReportStatus {
    let targetStatus = dto.status;
    if (!targetStatus) {
      if (actions.includes(ReportAction.dismiss)) {
        targetStatus = ReportStatus.dismissed;
      } else if (actions.length > 0) {
        targetStatus = ReportStatus.action_taken;
      } else {
        targetStatus = currentStatus;
      }
    }

    const actionValidation = validateReportActions(actions, targetStatus);
    if (!actionValidation.valid) {
      throw createHttpException(
        errors.common.badRequest,
        actionValidation.message,
      );
    }

    return targetStatus;
  }

  private async resolveSanctionTarget(
    tx: Prisma.TransactionClient,
    report: { subject: ReportSubject; target_id: number },
  ): Promise<{
    targetUserId: number | null;
    targetAuthorRole: Role | undefined;
  }> {
    if (report.subject === ReportSubject.recipe) {
      const recipe = await tx.recipe.findUnique({
        where: { id: report.target_id },
        include: { user: { select: { id: true, role: true } } },
      });
      if (!recipe) {
        throw new NotFoundException('Target recipe not found');
      }
      return {
        targetUserId: recipe.user_id,
        targetAuthorRole: recipe.user?.role,
      };
    }

    if (report.subject === ReportSubject.comment) {
      const comment = await tx.comment.findUnique({
        where: { id: report.target_id },
        include: { user: { select: { id: true, role: true } } },
      });
      if (!comment) {
        throw new NotFoundException('Target comment not found');
      }
      return {
        targetUserId: comment.user_id,
        targetAuthorRole: comment.user?.role,
      };
    }

    if (report.subject === ReportSubject.user) {
      const user = await tx.user.findFirst({
        where: { id: report.target_id, deleted_at: null },
        select: { id: true, role: true },
      });
      if (!user) {
        throw new NotFoundException('Target user not found');
      }
      return {
        targetUserId: user.id,
        targetAuthorRole: user.role,
      };
    }

    return { targetUserId: null, targetAuthorRole: undefined };
  }

  private assertModeratorHierarchy(
    callerRole: Role | string | undefined,
    targetAuthorRole: Role | undefined,
    actions: ReportAction[],
  ): void {
    const isPrivilegedTarget =
      targetAuthorRole === Role.admin || targetAuthorRole === Role.moderator;
    if (callerRole !== Role.moderator || !isPrivilegedTarget) {
      return;
    }

    const roleLabel =
      targetAuthorRole === Role.admin ? 'administrators' : 'other moderators';
    const singularLabel =
      targetAuthorRole === Role.admin ? 'administrator' : 'moderator';

    if (actions.includes(ReportAction.warn)) {
      throw createHttpException(
        errors.common.forbidden,
        `Moderators cannot moderate or warn ${roleLabel}`,
      );
    }
    if (actions.includes(ReportAction.delete_content)) {
      throw createHttpException(
        errors.common.forbidden,
        `Moderators cannot moderate or delete ${singularLabel} content`,
      );
    }
    if (actions.includes(ReportAction.ban)) {
      throw createHttpException(
        errors.moderation.cannotBanAdmin,
        `Moderators cannot moderate or ban ${singularLabel}`,
      );
    }
  }

  private async executeReportContentDeactivation(
    tx: Prisma.TransactionClient,
    report: { id: number; subject: ReportSubject; target_id: number },
  ): Promise<void> {
    if (report.subject === ReportSubject.recipe) {
      await tx.recipe.update({
        where: { id: report.target_id },
        data: { is_active: false, suspended_by_ban: false },
      });
      this.logger.log(
        `Audit: Report #${report.id} resolved with delete_content. Recipe #${report.target_id} suspended.`,
      );
      return;
    }

    if (report.subject === ReportSubject.comment) {
      await tx.comment.update({
        where: { id: report.target_id },
        data: { is_active: false },
      });
      await tx.notification.deleteMany({
        where: {
          subject: NotificationSubject.comment,
          target_id: report.target_id,
          is_read: false,
        },
      });
      this.logger.log(
        `Audit: Report #${report.id} resolved with delete_content. Comment #${report.target_id} deactivated.`,
      );
    }
  }

  private async executeReportBanAction(
    tx: Prisma.TransactionClient,
    params: {
      reportId: number;
      callerId: number | undefined;
      callerRole: Role | string | undefined;
      dto: UpdateReportDto;
      effectiveReason: ReportReason;
      resolvedTargetUserId: number | null;
    },
  ): Promise<void> {
    const {
      reportId,
      callerId,
      callerRole,
      dto,
      effectiveReason,
      resolvedTargetUserId,
    } = params;

    const isPermanent = Boolean(dto.permanent);
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

    let durationDays: number | null = null;
    let bannedUntil: Date | null = null;
    if (!isPermanent) {
      durationDays =
        dto.ban_duration_days ?? getDefaultBanDuration(effectiveReason);
      bannedUntil = new Date(Date.now() + durationDays * 86400000);
    }

    if (!resolvedTargetUserId) {
      return;
    }

    await tx.user.update({
      where: { id: resolvedTargetUserId },
      data: {
        status: UserStatus.banned,
        banned_until: bannedUntil,
      },
    });

    await tx.recipe.updateMany({
      where: { user_id: resolvedTargetUserId, is_active: true },
      data: { is_active: false, suspended_by_ban: true },
    });

    await tx.jwtSession.deleteMany({
      where: { id_user: resolvedTargetUserId },
    });

    await this.banHistoryService.closeOpenBans?.(
      resolvedTargetUserId,
      callerId ?? null,
      'Superseded by updated ban',
      tx,
    );

    await this.banHistoryService.recordSanction(
      {
        userId: resolvedTargetUserId,
        bannedById: callerId!,
        reason: effectiveReason,
        action: ReportAction.ban,
        description: dto.resolution_description?.trim() || null,
        internalNotes: dto.resolution_notes?.trim() || null,
        durationDays,
        isPermanent,
        reportId,
        expiresAt: bannedUntil,
      },
      tx,
    );

    this.logger.log(
      `Audit: Report #${reportId} resolved with ban. User #${resolvedTargetUserId} banned (duration: ${durationDays ?? 'permanent'} days).`,
    );
  }

  private async emitReportWarnNotification(
    report: {
      id: number;
      subject: ReportSubject;
      target_id: number;
      actions?: ReportAction[];
    },
    actions: ReportAction[],
    dto: UpdateReportDto,
    callerId?: number,
  ): Promise<void> {
    const shouldWarn =
      actions.includes(ReportAction.warn) &&
      !actions.includes(ReportAction.dismiss) &&
      !(report.actions ?? []).includes(ReportAction.warn);

    if (!shouldWarn || !callerId) {
      return;
    }

    try {
      await this.notificationEmit.notification(
        {
          id_user: callerId,
          id_target: report.target_id,
          details: dto.resolution_description?.trim() || null,
        },
        {
          subject: report.subject,
          action: NotificationAction.warn,
        },
      );
    } catch (err) {
      // The report is already resolved: a failed notification must not fail the request.
      this.logger.error(
        `Report #${report.id}: warn notification failed`,
        err instanceof Error ? err.stack : String(err),
      );
    }
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
    const callerRole = typeof caller === 'object' ? caller.role : undefined;
    const callerId = typeof caller === 'number' ? caller : caller?.id;
    const actions: ReportAction[] = [...(dto.actions ?? [])];

    const txOutcome = await this.prisma.$transaction(async (tx) => {
      if (typeof (tx as any).$queryRaw === 'function') {
        await (tx as any)
          .$queryRaw`SELECT id FROM "reports" WHERE id = ${reportId} FOR UPDATE`;
      }

      const report = await tx.report.findUnique({
        where: { id: reportId },
      });
      if (!report) {
        throw new NotFoundException('Report not found');
      }

      if (report.status === ReportStatus.dismissed) {
        throw new ConflictException('Report has already been dismissed');
      }

      const targetStatus = this.resolveTargetStatus(dto, report.status, actions);

      if (
        (actions.includes(ReportAction.ban) ||
          actions.includes(ReportAction.warn)) &&
        !callerId
      ) {
        throw createHttpException(
          errors.common.unauthorized,
          'Authenticated staff user ID is required to issue sanctions',
        );
      }

      const effectiveReason = dto.resolution_reason ?? report.reason;
      const previousActions = new Set(report.actions ?? []);
      const actionsToExecute = actions.filter(
        (action) => !previousActions.has(action),
      );
      const mergedActions = Array.from(
        new Set([...(report.actions ?? []), ...actions]),
      );
      const mergedValidation = validateReportActions(
        mergedActions,
        targetStatus,
      );
      if (!mergedValidation.valid) {
        throw createHttpException(
          errors.common.badRequest,
          mergedValidation.message,
        );
      }

      const requiresTargetResolution =
        actions.includes(ReportAction.delete_content) ||
        actions.includes(ReportAction.ban) ||
        actions.includes(ReportAction.warn);

      let resolvedTargetUserId: number | null = null;
      let previousBansCount = 0;
      let previousWarningsCount = 0;

      if (requiresTargetResolution) {
        const { targetUserId, targetAuthorRole } =
          await this.resolveSanctionTarget(tx, report);
        resolvedTargetUserId = targetUserId;

        this.assertModeratorHierarchy(callerRole, targetAuthorRole, actions);

        previousBansCount = resolvedTargetUserId
          ? await this.banHistoryService.getPreviousBansCount(
              resolvedTargetUserId,
              tx,
            )
          : 0;
        previousWarningsCount = resolvedTargetUserId
          ? await this.banHistoryService.getPreviousWarningsCount(
              resolvedTargetUserId,
              tx,
            )
          : 0;

        if (actionsToExecute.includes(ReportAction.warn) && resolvedTargetUserId) {
          await this.banHistoryService.recordSanction(
            {
              userId: resolvedTargetUserId,
              bannedById: callerId!,
              reason: effectiveReason,
              action: ReportAction.warn,
              description: dto.resolution_description?.trim() || null,
              internalNotes: dto.resolution_notes?.trim() || null,
              reportId: report.id,
            },
            tx,
          );
          this.logger.log(
            `Audit: Report #${reportId} resolved with warning for user #${resolvedTargetUserId} by staff #${callerId ?? 0}.`,
          );
        }

        if (actionsToExecute.includes(ReportAction.delete_content)) {
          await this.executeReportContentDeactivation(tx, report);
        }

        if (actionsToExecute.includes(ReportAction.ban)) {
          await this.executeReportBanAction(tx, {
            reportId: report.id,
            callerId,
            callerRole,
            dto,
            effectiveReason,
            resolvedTargetUserId,
          });
        }
      }

      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: targetStatus,
          actions: mergedActions,
          resolution_reason: effectiveReason,
          resolution_description:
            dto.resolution_description !== undefined
              ? dto.resolution_description?.trim() || null
              : undefined,
          resolution_notes:
            dto.resolution_notes !== undefined
              ? dto.resolution_notes?.trim() || null
              : undefined,
          ...(callerId
            ? {
                resolved_by_id: callerId,
                resolved_at: new Date(),
              }
            : {}),
        },
      });

      return {
        reportSnapshot: report,
        actionsExecuted: actionsToExecute,
        resolvedTargetUserId,
        result: {
          ...updatedReport,
          actions: updatedReport.actions ?? mergedActions,
          previous_bans_count: previousBansCount,
          previous_warnings_count: previousWarningsCount,
        },
      };
    });

    await this.emitReportWarnNotification(
      txOutcome.reportSnapshot,
      txOutcome.actionsExecuted,
      dto,
      callerId,
    );

    if (txOutcome.actionsExecuted.includes(ReportAction.ban)) {
      const targetUserId = txOutcome.resolvedTargetUserId;
      if (targetUserId) {
        const evictPayload: UserEvictEventPayload = { userId: targetUserId };
        this.eventEmitter?.emit(USER_EVICT_EVENT, evictPayload);
      }
    }

    const [hydratedResult] = await this.hydrateReportItems(
      [txOutcome.result],
      '',
      {
        skipSanctionCounts: true,
      },
    );
    return hydratedResult;
  }
}
