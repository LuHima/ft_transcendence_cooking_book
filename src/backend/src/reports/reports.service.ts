import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import {
  ReportItemDto,
  PaginatedReportsResponseDto,
} from './dto/report-response.dto';
import { Prisma, ReportStatus, ReportSubject } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
   * Update report status and record moderation resolution notes.
   */
  async updateReport(
    reportId: number,
    dto: UpdateReportDto,
  ): Promise<ReportItemDto> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: dto.status,
        ...(dto.resolution_notes !== undefined
          ? { resolution_notes: dto.resolution_notes.trim() || null }
          : {}),
      },
    });
  }
}
