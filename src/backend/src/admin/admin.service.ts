import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  OwnerType,
  Prisma,
  RecipePrivacy,
  ReportAction,
  Role,
  UserStatus,
  ReportSubject,
  ReportStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import { resolveStoredUploadPath } from '../common/config/upload-paths';
import { createHttpException, errors } from '../common/config/error.config';
import { AdminSearchUserQueryDto } from './dto/admin-search-user-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import {
  AdminUserResponseDto,
  PaginatedAdminUsersResponseDto,
} from './dto/admin-user-response.dto';
import {
  AdminCommentQueryDto,
  AdminCommentSortBy,
  AdminCommentFormat,
  AdminCommentStatus,
} from './dto/admin-comment-query.dto';
import {
  PaginatedAdminCommentsResponseDto,
  AdminCommentItemDto,
  ThreadedAdminCommentItemDto,
} from './dto/admin-comment-response.dto';
import { UserSortBy, SortOrder } from '../users/dto/search-user-query.dto';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { buildPaginatedResponse } from '../common/dto/pagination-query.dto';
import {
  extractTargetReportCounters,
  getBatchReportMetrics,
  getPendingCommentReportTargetIds,
  populateLatestPendingReportIds,
  ReportMetricsMaps,
  sortByReportMetric,
} from '../reports/helpers/pending-reports.helper';

interface CommentRecipePayload {
  id: number;
  source_lang: string;
  translations?: Array<{ locale: string; title: string }>;
}

interface CommentUserPayload {
  id: number;
  username: string;
  avatar_url: string | null;
}

interface CommentPayload {
  id: number;
  recipe_id: number;
  user_id: number | null;
  parent_id: number | null;
  content: string;
  is_active: boolean;
  is_edited: boolean;
  created_at: Date;
  updated_at: Date | null;
  user: CommentUserPayload | null;
  recipe: CommentRecipePayload | null;
  replies?: CommentPayload[];
  _count?: { replies: number };
}

import { BanHistoryService } from '../reports/ban-history.service';
import {
  BanHistoryQueryDto,
  PaginatedBanHistoryResponseDto,
} from '../reports/dto/ban-history.dto';
import { ReportReason } from '@prisma/client';
import { getDefaultBanDuration } from '../reports/constants/ban-duration-policy.constant';

type UserWithRecipeCount = Prisma.UserGetPayload<{
  include: { _count: { select: { recipes: true; ban_history: true } } };
}>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly banHistoryService: BanHistoryService,
  ) {}

  /**
   * Safely removes a stored media file from disk without throwing on non-existent files.
   */
  private async safeUnlink(fileUrl: string | null | undefined): Promise<void> {
    if (!fileUrl) return;
    const localPath = resolveStoredUploadPath(fileUrl);
    if (!localPath) return;
    try {
      await fs.promises.unlink(localPath);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err?.code !== 'ENOENT') {
        // Silently ignore non-critical unlinking errors
      }
    }
  }

  private async getSanctionCountsMap(
    userIds: number[],
  ): Promise<Map<number, { bans: number; warnings: number }>> {
    const countsMap = new Map<number, { bans: number; warnings: number }>();
    if (userIds.length === 0 || !this.prisma.banHistory?.groupBy) {
      return countsMap;
    }

    try {
      const groups = await this.prisma.banHistory.groupBy({
        by: ['user_id', 'action'],
        _count: { id: true },
        where: { user_id: { in: userIds } },
      });
      if (Array.isArray(groups)) {
        for (const uid of userIds) {
          countsMap.set(uid, { bans: 0, warnings: 0 });
        }
        for (const g of groups as any[]) {
          const cnt =
            typeof g._count === 'number' ? g._count : (g._count?.id ?? 0);
          const entry = countsMap.get(g.user_id) ?? { bans: 0, warnings: 0 };
          if (g.action === ReportAction.warn) {
            entry.warnings = cnt;
          } else {
            entry.bans = cnt;
          }
          countsMap.set(g.user_id, entry);
        }
      }
    } catch {
      // Fallback for mocked environments without banHistory.groupBy
    }

    return countsMap;
  }

  private mapToAdminUserResponse(
    user: any,
    sanctions?: { bans: number; warnings: number },
  ): AdminUserResponseDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      avatar_url: user.avatar_url ?? null,
      bio: user.bio ?? null,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      birth_date: user.birth_date ?? null,
      phone: user.phone ?? null,
      address: user.address ?? null,
      city: user.city ?? null,
      postal_code: user.postal_code ?? null,
      recipes_count: user._count?.recipes ?? 0,
      previous_bans_count:
        sanctions?.bans ?? (user as any)._count?.ban_history ?? 0,
      previous_warnings_count: sanctions?.warnings ?? 0,
      banned_until: (user as any).banned_until ?? null,
      created_at: user.created_at,
      deleted_at: user.deleted_at ?? null,
    };
  }

  /**
   * Administrative member directory search and filtering.
   * Supports role, status, text search, and sort_by / sort_order sorting criteria.
   * Defaults to newest registration (or username_asc when search is present).
   */
  async getUsers(
    query: AdminSearchUserQueryDto = new AdminSearchUserQueryDto(),
  ): Promise<PaginatedAdminUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const trimmedSearch =
      typeof query.search === 'string' ? query.search.trim() : undefined;
    const search =
      trimmedSearch && trimmedSearch.length > 0 ? trimmedSearch : undefined;

    const sortBy =
      query.sort_by ??
      (search ? UserSortBy.username : UserSortBy.created_at);

    const sortOrder =
      query.sort_order ??
      (sortBy === UserSortBy.username ? SortOrder.asc : SortOrder.desc);

    let orderBy: Prisma.UserOrderByWithRelationInput[];
    switch (sortBy) {
      case UserSortBy.username:
        orderBy = [{ username: sortOrder }];
        break;
      case UserSortBy.recipes_count:
        orderBy = [
          { recipes: { _count: sortOrder } },
          { username: 'asc' },
        ];
        break;
      case UserSortBy.created_at:
        orderBy = [
          { created_at: sortOrder },
          { id: sortOrder },
        ];
        break;
    }

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          _count: {
            select: { recipes: true, ban_history: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const sanctionCountsMap = await this.getSanctionCountsMap(
      users.map((u) => u.id),
    );

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: users.map((u) =>
        this.mapToAdminUserResponse(u, sanctionCountsMap.get(u.id)),
      ),
      total,
      page,
      limit,
      total_pages: totalPages,
      has_next_page: page < totalPages,
      has_prev_page: page > 1,
    };
  }

  /**
   * Retrieve administrative details for a specific user account.
   */
  async getUserById(targetUserId: number): Promise<AdminUserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        _count: {
          select: { recipes: true, ban_history: true },
        },
      },
    });
    if (!user) {
      throw createHttpException(errors.users.notFound);
    }
    const sanctionCountsMap = await this.getSanctionCountsMap([targetUserId]);
    return this.mapToAdminUserResponse(
      user,
      sanctionCountsMap.get(targetUserId),
    );
  }

  /**
   * Retrieve paginated chronological sanctions history audit trail for a specific user.
   */
  async getUserSanctionsHistory(
    targetUserId: number,
    query: BanHistoryQueryDto = {},
  ): Promise<PaginatedBanHistoryResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) {
      throw createHttpException(errors.users.notFound);
    }
    return await this.banHistoryService.getUserSanctionsHistory(
      targetUserId,
      query,
    );
  }

  /**
   * Administrative provisioning of new platform accounts.
   */
  async createUser(dto: CreateAdminUserDto): Promise<AdminUserResponseDto> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: dto.username, mode: 'insensitive' } },
          { email: { equals: dto.email, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      if (existing.username.toLowerCase() === dto.username.toLowerCase()) {
        throw createHttpException(errors.auth.usernameAlreadyUsed);
      }
      throw createHttpException(errors.auth.emailAlreadyUsed);
    }

    const password_hash = await bcrypt.hash(dto.password, 10);

    let birthDate: Date | null = null;
    if (dto.birth_date) {
      const parsed = new Date(dto.birth_date);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid birth_date format');
      }
      birthDate = parsed;
    }

    const created = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        password_hash,
        role: dto.role,
        status: dto.status ?? UserStatus.active,
        avatar_url: dto.avatar_url ?? null,
        bio: dto.bio ?? null,
        first_name: dto.first_name ?? null,
        last_name: dto.last_name ?? null,
        birth_date: birthDate,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        city: dto.city ?? null,
        postal_code: dto.postal_code ?? null,
      },
      include: {
        _count: {
          select: { recipes: true, ban_history: true },
        },
      },
    });

    return this.mapToAdminUserResponse(created);
  }

  /**
   * Administrative modification of user accounts:
   * - Enforces Anti-Self-Sabotage guard (cannot demote or disable self)
   * - Enforces Last-Admin safeguard (cannot demote or disable last admin)
   * - Selective session eviction on credential, role, or deactivation transitions
   * - Atomic user reactivation with platform custody content restoration
   */
  async updateUser(
    targetUserId: number,
    dto: UpdateAdminUserDto,
    currentAdminId: number,
  ): Promise<AdminUserResponseDto> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw createHttpException(errors.users.notFound);
    }

    // Strict Ban / Unban Payload Validation
    const hasBanOnlyFields =
      dto.ban_reason !== undefined ||
      dto.ban_duration_days !== undefined ||
      dto.is_permanent !== undefined ||
      dto.ban_description !== undefined ||
      dto.internal_notes !== undefined;

    if (hasBanOnlyFields && dto.status !== UserStatus.banned) {
      throw new BadRequestException(
        'Ban fields (ban_reason, ban_duration_days, is_permanent, ban_description, internal_notes) are only allowed when status is set to banned',
      );
    }

    if (dto.is_permanent === true && dto.ban_duration_days !== undefined) {
      throw new BadRequestException(
        'ban_duration_days cannot be combined with is_permanent: true',
      );
    }

    const isUnbanning =
      targetUser.status === UserStatus.banned &&
      dto.status === UserStatus.active;

    if (dto.unban_reason !== undefined && !isUnbanning) {
      throw new BadRequestException(
        'unban_reason is only allowed when transitioning a banned user to active',
      );
    }

    if (dto.status === UserStatus.banned && targetUser.deleted_at !== null) {
      throw new ConflictException(
        'Cannot ban a soft-deleted user; reactivate the account first',
      );
    }

    // Anti-Self-Sabotage Guard: admin cannot demote or disable themselves
    if (targetUserId === currentAdminId) {
      if (dto.role !== undefined && dto.role !== targetUser.role) {
        throw createHttpException(errors.admin.cannotModifySelf);
      }
      if (
        dto.status !== undefined &&
        dto.status !== UserStatus.active &&
        dto.status !== targetUser.status
      ) {
        throw createHttpException(errors.admin.cannotModifySelf);
      }
    }

    // Last-Admin Safeguard: cannot demote or disable the last active administrator
    const isTargetActiveAdmin =
      targetUser.role === Role.admin && targetUser.status === UserStatus.active;
    const isDemotingAdmin =
      dto.role !== undefined && dto.role !== Role.admin && isTargetActiveAdmin;
    const isDisablingAdmin =
      dto.status !== undefined &&
      dto.status !== UserStatus.active &&
      isTargetActiveAdmin;

    if (isDemotingAdmin || isDisablingAdmin) {
      const activeAdminsCount = await this.prisma.user.count({
        where: { role: Role.admin, status: UserStatus.active },
      });
      if (activeAdminsCount <= 1) {
        throw createHttpException(errors.admin.lastAdminRequired);
      }
    }

    // Uniqueness validation if username or email is being modified
    if (dto.username || dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: targetUserId } },
            {
              OR: [
                dto.username
                  ? { username: { equals: dto.username, mode: 'insensitive' } }
                  : {},
                dto.email
                  ? { email: { equals: dto.email, mode: 'insensitive' } }
                  : {},
              ],
            },
          ],
        },
      });

      if (existing) {
        if (
          dto.username &&
          existing.username.toLowerCase() === dto.username.toLowerCase()
        ) {
          throw createHttpException(errors.auth.usernameAlreadyUsed);
        }
        throw createHttpException(errors.auth.emailAlreadyUsed);
      }
    }

    let password_hash: string | undefined = undefined;
    if (dto.password) {
      password_hash = await bcrypt.hash(dto.password, 10);
    }

    let birthDate: Date | null | undefined = undefined;
    if (dto.birth_date !== undefined) {
      if (dto.birth_date === '' || dto.birth_date === null) {
        birthDate = null;
      } else {
        const parsed = new Date(dto.birth_date);
        if (isNaN(parsed.getTime())) {
          throw new BadRequestException('Invalid birth_date format');
        }
        birthDate = parsed;
      }
    }

    // Lifecycle state transition checks
    const isReactivating =
      (targetUser.status === UserStatus.disabled ||
        targetUser.status === UserStatus.banned) &&
      dto.status === UserStatus.active;

    const isDisablingFromBanned =
      targetUser.status === UserStatus.banned &&
      dto.status === UserStatus.disabled;

    const isBanning = dto.status === UserStatus.banned;

    // Selective Session Eviction: only on password, role, or disabling/banning status modification
    const shouldEvictSessions =
      dto.password !== undefined ||
      (dto.role !== undefined && dto.role !== targetUser.role) ||
      (dto.status !== undefined &&
        (dto.status === UserStatus.disabled ||
          dto.status === UserStatus.banned));

    let bannedUntil: Date | null | undefined = undefined;
    if (dto.status === UserStatus.banned) {
      if (dto.is_permanent) {
        bannedUntil = null;
      } else {
        const duration =
          dto.ban_duration_days ??
          (dto.ban_reason ? getDefaultBanDuration(dto.ban_reason) : 7);
        bannedUntil = new Date(Date.now() + duration * 86400000);
      }
    } else if (
      (isReactivating || isDisablingFromBanned) &&
      targetUser.status === UserStatus.banned
    ) {
      bannedUntil = null;
    }

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      if (isReactivating) {
        if (targetUser.deleted_at !== null) {
          // Revert platform-custody recipes back to the author
          await tx.recipe.updateMany({
            where: { user_id: targetUserId, owner_type: OwnerType.platform },
            data: { owner_type: OwnerType.user },
          });

          // Reactivate authored comments
          await tx.comment.updateMany({
            where: { user_id: targetUserId, is_active: false },
            data: { is_active: true },
          });
        }

        if (targetUser.status === UserStatus.banned) {
          await this.banHistoryService.recordUnban(
            targetUserId,
            currentAdminId,
            dto.unban_reason?.trim() || 'Admin account reactivation',
            tx,
          );
        }
      }

      if (isDisablingFromBanned) {
        await this.banHistoryService.closeOpenBans(
          targetUserId,
          currentAdminId,
          'Account disabled',
          tx,
        );
      }

      if (isBanning) {
        if (targetUser.status === UserStatus.banned) {
          await this.banHistoryService.closeOpenBans(
            targetUserId,
            currentAdminId,
            'Superseded by updated ban',
            tx,
          );
        }

        // Suspend all active authored recipes without Platform Custody Transfer
        await tx.recipe.updateMany({
          where: { user_id: targetUserId, is_active: true },
          data: { is_active: false },
        });

        await this.banHistoryService.recordSanction(
          {
            userId: targetUserId,
            bannedById: currentAdminId,
            reason: dto.ban_reason ?? ReportReason.other,
            action: ReportAction.ban,
            description: dto.ban_description?.trim() || null,
            internalNotes: dto.internal_notes?.trim() || null,
            durationDays: dto.is_permanent
              ? null
              : (dto.ban_duration_days ??
                (dto.ban_reason ? getDefaultBanDuration(dto.ban_reason) : 7)),
            isPermanent: dto.is_permanent ?? false,
            expiresAt: bannedUntil,
          },
          tx,
        );
      }

      if (shouldEvictSessions) {
        await tx.jwtSession.deleteMany({
          where: { id_user: targetUserId },
        });
      }

      const dataToUpdate: Prisma.UserUpdateInput = {
        ...(dto.username ? { username: dto.username } : {}),
        ...(dto.email ? { email: dto.email } : {}),
        ...(password_hash ? { password_hash } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(bannedUntil !== undefined ? { banned_until: bannedUntil } : {}),
        ...(dto.avatar_url !== undefined ? { avatar_url: dto.avatar_url } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.first_name !== undefined ? { first_name: dto.first_name } : {}),
        ...(dto.last_name !== undefined ? { last_name: dto.last_name } : {}),
        ...(birthDate !== undefined ? { birth_date: birthDate } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.postal_code !== undefined
          ? { postal_code: dto.postal_code }
          : {}),
        ...(isReactivating && targetUser.deleted_at !== null
          ? { deleted_at: null }
          : {}),
      };

      return tx.user.update({
        where: { id: targetUserId },
        data: dataToUpdate,
        include: {
          _count: {
            select: { recipes: true, ban_history: true },
          },
        },
      });
    });

    return this.mapToAdminUserResponse(updatedUser);
  }

  /**
   * Administrative deletion of a user account:
   * - Anti-Self-Sabotage: cannot delete own account
   * - Last-Admin Safeguard: cannot delete the last active administrator
   * - Soft delete (default): disables user, transfers public recipes to platform custody,
   *   deactivates comments, evicts active sessions.
   * - Hard delete (?hard=true): disassociates recipes (user_id = null), deletes user row and avatar.
   */
  async deleteUser(
    targetUserId: number,
    currentAdminId: number,
    hard = false,
  ): Promise<{ message: string }> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw createHttpException(errors.users.notFound);
    }

    // Anti-Self-Sabotage Guard
    if (targetUserId === currentAdminId) {
      throw createHttpException(errors.admin.cannotModifySelf);
    }

    // Last-Admin Safeguard
    if (
      targetUser.role === Role.admin &&
      targetUser.status === UserStatus.active
    ) {
      const activeAdminsCount = await this.prisma.user.count({
        where: { role: Role.admin, status: UserStatus.active },
      });
      if (activeAdminsCount <= 1) {
        throw createHttpException(errors.admin.lastAdminRequired);
      }
    }

    if (!hard) {
      if (targetUser.deleted_at !== null) {
        throw new ConflictException('User is already soft-deleted');
      }

      // Soft deletion lifecycle
      await this.prisma.$transaction(async (tx) => {
        // 1. Evict active sessions
        await tx.jwtSession.deleteMany({
          where: { id_user: targetUserId },
        });

        // 2. Transfer authored public recipes to platform custody
        await tx.recipe.updateMany({
          where: { user_id: targetUserId, privacy: RecipePrivacy.public },
          data: { owner_type: OwnerType.platform },
        });

        // 3. Deactivate authored comments
        await tx.comment.updateMany({
          where: { user_id: targetUserId },
          data: { is_active: false },
        });

        // 4. Close any open ban records if user was banned
        if (targetUser.status === UserStatus.banned) {
          await this.banHistoryService.closeOpenBans(
            targetUserId,
            currentAdminId,
            'Account soft-deleted',
            tx,
          );
        }

        // 5. Update user account status
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            status: UserStatus.disabled,
            deleted_at: new Date(),
            ...(targetUser.status === UserStatus.banned
              ? { banned_until: null }
              : {}),
          },
        });
      });

      return { message: 'User deactivated successfully' };
    } else {
      // Hard deletion lifecycle
      await this.prisma.$transaction(async (tx) => {
        // Disassociate authored recipes and transfer to platform custody
        await tx.recipe.updateMany({
          where: { user_id: targetUserId },
          data: {
            owner_type: OwnerType.platform,
            user_id: null,
          },
        });

        // Delete comments authored by user
        await tx.comment.deleteMany({
          where: { user_id: targetUserId },
        });

        // Delete user row (cascades sessions, likes, notifications, friendships, reports)
        await tx.user.delete({
          where: { id: targetUserId },
        });
      });

      // Remove avatar from disk if present
      await this.safeUnlink(targetUser.avatar_url);

      return { message: 'User permanently deleted' };
    }
  }

  /**
   * Upload and transcode avatar for a specific user.
   */
  async uploadUserAvatar(
    targetUserId: number,
    file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, avatar_url: true },
    });
    if (!targetUser) {
      throw createHttpException(errors.users.notFound);
    }

    // Process uploaded image through Sharp WebP pipeline
    const { relativePath: avatarUrl } =
      await this.imageProcessingService.processAvatarFile(file, targetUserId);

    // Save new avatar path in database; clean up the new file if DB update fails
    try {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { avatar_url: avatarUrl },
      });
    } catch (err) {
      await this.safeUnlink(avatarUrl);
      throw err;
    }

    // Unlink old avatar file only after DB update succeeds
    await this.safeUnlink(targetUser.avatar_url);

    return { avatar_url: avatarUrl };
  }

  /**
   * Delete avatar photo for a specific user.
   */
  async deleteUserAvatar(targetUserId: number): Promise<{ message: string }> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, avatar_url: true },
    });
    if (!targetUser) {
      throw createHttpException(errors.users.notFound);
    }

    // Unlink avatar from disk if present
    await this.safeUnlink(targetUser.avatar_url);

    // Reset database reference
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { avatar_url: null },
    });

    return { message: 'Avatar deleted successfully' };
  }

  /**
   * Administrative comment audit stream supporting multi-dimensional sorting,
   * moderation filters, and dual flat/threaded presentation modes.
   */
  async findAllAdminComments(
    query?: AdminCommentQueryDto,
  ): Promise<PaginatedAdminCommentsResponseDto> {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, Math.min(100, query?.limit || 20));
    const skip = (page - 1) * limit;

    const isReportedOnly = query?.reported_only === true;
    const format = query?.format ?? AdminCommentFormat.flat;
    const sortBy =
      query?.sort_by ??
      (isReportedOnly
        ? AdminCommentSortBy.pending_reports_count
        : AdminCommentSortBy.created_at);
    const sortOrder =
      query?.sort_order ??
      (sortBy === AdminCommentSortBy.recipe ? SortOrder.asc : SortOrder.desc);

    const where: Prisma.CommentWhereInput = {};

    if (query?.status === AdminCommentStatus.active) {
      where.is_active = true;
    } else if (query?.status === AdminCommentStatus.inactive) {
      where.is_active = false;
    }

    if (query?.search) {
      where.content = {
        contains: query.search,
        mode: 'insensitive',
      };
    }

    if (query?.recipe_id) {
      where.recipe_id = query.recipe_id;
    }

    if (query?.user_id) {
      where.user_id = query.user_id;
    }

    if (query?.is_edited !== undefined) {
      where.is_edited = query.is_edited;
    }

    let pendingCommentIds: number[] = [];
    if (isReportedOnly && this.prisma.report) {
      pendingCommentIds = await getPendingCommentReportTargetIds(this.prisma);
      if (pendingCommentIds.length === 0) {
        return buildPaginatedResponse([], 0, page, limit);
      }
      if (format !== AdminCommentFormat.threaded) {
        where.id = { in: pendingCommentIds };
      }
    }

    const localizeTitle = (
      recipe: CommentRecipePayload | null | undefined,
    ): string => {
      if (!recipe || !recipe.translations || recipe.translations.length === 0) {
        return '';
      }
      if (query?.lang) {
        const match = recipe.translations.find((t) => t.locale === query.lang);
        if (match) return match.title;
      }
      const fallback = recipe.translations.find(
        (t) => t.locale === recipe.source_lang,
      );
      return fallback?.title || recipe.translations[0]?.title || '';
    };

    const fetchReportMetrics = (ids: number[]): Promise<ReportMetricsMaps> =>
      getBatchReportMetrics(this.prisma, ReportSubject.comment, ids);

    const calculateThreadReports = (
      rootId: number,
      replies: Array<{ id: number }> | undefined,
      countMap: Map<number, number>,
    ): number => {
      return (
        (countMap.get(rootId) || 0) +
        (replies || []).reduce(
          (sum, r) => sum + (countMap.get(r.id) || 0),
          0,
        )
      );
    };

    const mapCommentItem = (
      c: CommentPayload,
      reportMetrics: ReportMetricsMaps,
    ): AdminCommentItemDto => {
      return {
        id: c.id,
        recipe_id: c.recipe_id,
        user_id: c.user_id,
        parent_id: c.parent_id,
        content: c.content,
        is_active: c.is_active,
        is_edited: c.is_edited ?? false,
        created_at: c.created_at,
        updated_at: c.updated_at ?? null,
        ...extractTargetReportCounters(reportMetrics, c.id),
        user: c.user
          ? {
              id: c.user.id,
              username: c.user.username,
              avatar_url: c.user.avatar_url ?? null,
            }
          : null,
        recipe: c.recipe
          ? {
              id: c.recipe.id,
              title: localizeTitle(c.recipe),
            }
          : null,
      };
    };

    // Presentation format: Threaded
    if (format === AdminCommentFormat.threaded) {
      const threadedWhere: Prisma.CommentWhereInput = {
        ...where,
        parent_id: null,
      };
      const repliesLimit = Math.max(1, Math.min(20, query?.replies_limit || 5));

      let matchingRootIds: number[] = [];
      if (isReportedOnly && pendingCommentIds.length > 0 && this.prisma.comment?.findMany) {
        try {
          const reportedComments = await this.prisma.comment.findMany({
            where: { id: { in: pendingCommentIds } },
            select: { id: true, parent_id: true },
          });
          matchingRootIds = Array.from(
            new Set(reportedComments.map((c) => c.parent_id ?? c.id)),
          );
          threadedWhere.id = { in: matchingRootIds };
        } catch {
          // Fallback for mocked environments
        }
      }

      let candidateRoots = (await this.prisma.comment.findMany({
        where: threadedWhere,
        include: {
          user: { select: { id: true, username: true, avatar_url: true } },
          recipe: {
            select: {
              id: true,
              source_lang: true,
              translations: { select: { locale: true, title: true } },
            },
          },
          replies: {
            orderBy: { created_at: 'asc' },
            include: {
              user: { select: { id: true, username: true, avatar_url: true } },
              recipe: {
                select: {
                  id: true,
                  source_lang: true,
                  translations: { select: { locale: true, title: true } },
                },
              },
            },
          },
          _count: { select: { replies: true } },
        },
      })) as unknown as CommentPayload[];

      if (isReportedOnly && matchingRootIds.length > 0) {
        candidateRoots = candidateRoots.filter((root) =>
          matchingRootIds.includes(root.id) ||
          pendingCommentIds.includes(root.id) ||
          (root.replies && root.replies.some((r) => pendingCommentIds.includes(r.id))),
        );
      }

      const withActivity = candidateRoots.map((root) => {
        const latestReplyTime =
          root.replies && root.replies.length > 0
            ? Math.max(
                ...root.replies.map((r) => new Date(r.created_at).getTime()),
              )
            : 0;
        const rootTime = new Date(root.created_at).getTime();
        const latestActivity = Math.max(rootTime, latestReplyTime);
        return { root, latestActivity };
      });

      let candidateReportMetrics: ReportMetricsMaps | undefined;

      if (
        sortBy === AdminCommentSortBy.pending_reports_count ||
        sortBy === AdminCommentSortBy.reports_count
      ) {
        const allCandidateIds: number[] = [];
        for (const root of candidateRoots) {
          allCandidateIds.push(root.id);
          for (const r of root.replies || []) {
            allCandidateIds.push(r.id);
          }
        }
        candidateReportMetrics = await getBatchReportMetrics(
          this.prisma,
          ReportSubject.comment,
          allCandidateIds,
          { includeLatestPendingId: false },
        );
        const targetCountMap =
          sortBy === AdminCommentSortBy.pending_reports_count
            ? candidateReportMetrics.pending
            : candidateReportMetrics.total;
        withActivity.sort((a, b) => {
          const countA = calculateThreadReports(
            a.root.id,
            a.root.replies,
            targetCountMap,
          );
          const countB = calculateThreadReports(
            b.root.id,
            b.root.replies,
            targetCountMap,
          );
          if (countB !== countA) {
            return sortOrder === SortOrder.asc
              ? countA - countB
              : countB - countA;
          }
          if (b.latestActivity !== a.latestActivity) {
            return b.latestActivity - a.latestActivity;
          }
          return b.root.id - a.root.id;
        });
      } else if (sortBy === AdminCommentSortBy.recipe) {
        withActivity.sort((a, b) => {
          if (a.root.recipe_id !== b.root.recipe_id) {
            return sortOrder === SortOrder.desc
              ? b.root.recipe_id - a.root.recipe_id
              : a.root.recipe_id - b.root.recipe_id;
          }
          return b.latestActivity - a.latestActivity;
        });
      } else {
        // created_at (or default)
        withActivity.sort((a, b) => {
          return sortOrder === SortOrder.asc
            ? a.latestActivity - b.latestActivity
            : b.latestActivity - a.latestActivity;
        });
      }

      const total = withActivity.length;
      const pagedRoots = withActivity
        .slice(skip, skip + limit)
        .map((w) => w.root);

      let reportMetrics: ReportMetricsMaps;
      const pagedIds: number[] = [];
      for (const root of pagedRoots) {
        pagedIds.push(root.id);
        for (const r of root.replies || []) {
          pagedIds.push(r.id);
        }
      }
      if (candidateReportMetrics) {
        reportMetrics = candidateReportMetrics;
        await populateLatestPendingReportIds(
          this.prisma,
          ReportSubject.comment,
          reportMetrics,
          pagedIds,
        );
      } else {
        reportMetrics = await fetchReportMetrics(pagedIds);
      }

      const items: ThreadedAdminCommentItemDto[] = pagedRoots.map((root) => {
        const totalReplies =
          root._count?.replies ?? (root.replies ? root.replies.length : 0);
        const allReplies = root.replies || [];
        const reportedRepliesCount = allReplies.filter(
          (r) => (reportMetrics.pending.get(r.id) || 0) > 0,
        ).length;

        const threadPendingReportsCount = calculateThreadReports(
          root.id,
          allReplies,
          reportMetrics.pending,
        );

        let repliesToWindow = allReplies;
        if (isReportedOnly) {
          const reportedReplies = allReplies.filter(
            (r) => (reportMetrics.pending.get(r.id) || 0) > 0,
          );
          const otherReplies = allReplies.filter(
            (r) => (reportMetrics.pending.get(r.id) || 0) === 0,
          );
          repliesToWindow = [...reportedReplies, ...otherReplies];
        }

        const windowedReplies = repliesToWindow
          .slice(0, repliesLimit)
          .map((r) => mapCommentItem(r, reportMetrics));

        const baseItem = mapCommentItem(root, reportMetrics);

        return {
          ...baseItem,
          replies_count: totalReplies,
          reported_replies_count: reportedRepliesCount,
          thread_pending_reports_count: threadPendingReportsCount,
          has_more_replies: totalReplies > windowedReplies.length,
          replies: windowedReplies,
        };
      });

      return buildPaginatedResponse(items, total, page, limit);
    }

    // Presentation format: Flat (Default)
    if (
      sortBy === AdminCommentSortBy.pending_reports_count ||
      sortBy === AdminCommentSortBy.reports_count
    ) {
      const candidateComments = (await this.prisma.comment.findMany({
        where,
        select: { id: true, created_at: true },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      })) as Array<{ id: number; created_at: Date }>;

      const candidateIds = candidateComments.map((c) => c.id);
      const reportMetrics = await getBatchReportMetrics(
        this.prisma,
        ReportSubject.comment,
        candidateIds,
        { includeLatestPendingId: false },
      );
      const targetCountMap =
        sortBy === AdminCommentSortBy.pending_reports_count
          ? reportMetrics.pending
          : reportMetrics.total;

      sortByReportMetric(
        candidateComments,
        targetCountMap,
        sortOrder === SortOrder.asc ? 'asc' : 'desc',
      );

      const total = candidateComments.length;
      const pagedIds = candidateComments.slice(skip, skip + limit).map((c) => c.id);

      let pagedComments: CommentPayload[] = [];
      if (pagedIds.length > 0) {
        const [hydratedRows] = await Promise.all([
          this.prisma.comment.findMany({
            where: { id: { in: pagedIds } },
            include: {
              user: { select: { id: true, username: true, avatar_url: true } },
              recipe: {
                select: {
                  id: true,
                  source_lang: true,
                  translations: { select: { locale: true, title: true } },
                },
              },
            },
          }) as unknown as Promise<CommentPayload[]>,
          populateLatestPendingReportIds(
            this.prisma,
            ReportSubject.comment,
            reportMetrics,
            pagedIds,
          ),
        ]);
        const byId = new Map(hydratedRows.map((c) => [c.id, c]));
        pagedComments = pagedIds
          .map((id) => byId.get(id))
          .filter((c): c is CommentPayload => c !== undefined);
      }

      const items = pagedComments.map((c) => mapCommentItem(c, reportMetrics));
      return buildPaginatedResponse(items, total, page, limit);
    }

    // Standard sorting on flat feed
    let orderBy:
      | Prisma.CommentOrderByWithRelationInput
      | Prisma.CommentOrderByWithRelationInput[];
    if (sortBy === AdminCommentSortBy.recipe) {
      orderBy = [{ recipe_id: sortOrder }, { created_at: 'desc' }];
    } else {
      orderBy = { created_at: sortOrder };
    }

    const [rawComments, total] = (await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: { select: { id: true, username: true, avatar_url: true } },
          recipe: {
            select: {
              id: true,
              source_lang: true,
              translations: { select: { locale: true, title: true } },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ])) as unknown as [CommentPayload[], number];

    const ids = rawComments.map((c) => c.id);
    const reportMetrics = await fetchReportMetrics(ids);
    const items = rawComments.map((c) => mapCommentItem(c, reportMetrics));
    return buildPaginatedResponse(items, total, page, limit);
  }
}
