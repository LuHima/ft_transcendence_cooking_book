import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { RecipeService } from '../recipe/recipe.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import {
  ReportItemDto,
  PaginatedReportsResponseDto,
} from './dto/report-response.dto';
import { Prisma, ReportStatus, ReportSubject, Role, UserStatus } from '@prisma/client';
import { createHttpException, errors } from '../common/config/error.config';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeService: RecipeService,
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
    return await this.prisma.report.create({
      data: {
        reporter_id: reporterId,
        subject: dto.subject,
        target_id: dto.target_id,
        reason: dto.reason,
        description: dto.description?.trim() || null,
      },
    });
  }

  /**
   * Retrieve paginated content reports with optional status and subject filtering.
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

    const total_pages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      total_pages,
      has_next_page: page < total_pages,
      has_prev_page: page > 1,
    };
  }

  /**
   * Update report status, apply recipe suspension or user ban sanctions,
   * emit audit logs, and record moderation resolution details.
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

    const resolutionAction = dto.resolution || dto.action;

    // Content Report Resolution Integration for Recipes (Ticket #106)
    if (
      report.subject === ReportSubject.recipe &&
      dto.status === ReportStatus.action_taken
    ) {
      if (resolutionAction === 'delete_content') {
        // Enforces role hierarchy (throws 403 Forbidden if moderator resolves against admin recipe)
        await this.recipeService.deactivateRecipe(
          report.target_id,
          caller ?? { id: 0, role: Role.admin },
        );

        this.logger.log(
          `Audit: Report #${reportId} resolved with delete_content. Recipe #${report.target_id} suspended.`,
        );
      } else if (resolutionAction === 'ban') {
        const recipe = await this.prisma.recipe.findUnique({
          where: { id: report.target_id },
          include: {
            user: { select: { id: true, role: true } },
          },
        });

        if (recipe && recipe.user_id) {
          const callerRole =
            typeof caller === 'object' ? caller.role : undefined;
          if (
            callerRole === Role.moderator &&
            recipe.user?.role === Role.admin
          ) {
            throw createHttpException(
              errors.common.forbidden,
              'Moderators cannot moderate or delete administrator content',
            );
          }

          // Transition user status to banned
          await this.prisma.user.update({
            where: { id: recipe.user_id },
            data: { status: UserStatus.banned },
          });

          // Automatically suspend all active recipes authored by the banned user
          await this.prisma.recipe.updateMany({
            where: { user_id: recipe.user_id, is_active: true },
            data: { is_active: false },
          });

          // Evict active JWT sessions
          if ((this.prisma as any).jwtSession) {
            await (this.prisma as any).jwtSession.deleteMany({
              where: { id_user: recipe.user_id },
            });
          }

          this.logger.log(
            `Audit: Report #${reportId} resolved with ban. User #${recipe.user_id} banned and authored recipes suspended.`,
          );
        }
      }
    }

    const callerId = typeof caller === 'number' ? caller : caller?.id;

    return await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        ...(dto.resolution_notes !== undefined
          ? { resolution_notes: dto.resolution_notes.trim() || null }
          : {}),
        ...(callerId
          ? {
              resolved_by_id: callerId,
              resolved_at: new Date(),
            }
          : {}),
      },
    });
  }
}
