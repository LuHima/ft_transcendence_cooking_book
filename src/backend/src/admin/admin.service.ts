import { BadRequestException, Injectable } from '@nestjs/common';
import { OwnerType, Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
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
import { UserSort } from '../users/dto/search-user-query.dto';
import { ImageProcessingService } from '../common/services/image-processing.service';

type UserWithRecipeCount = Prisma.UserGetPayload<{
  include: { _count: { select: { recipes: true } } };
}>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly imageProcessingService: ImageProcessingService,
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

  /**
   * Transforms a Prisma user entity (with relational recipe counts) into AdminUserResponseDto.
   */
  private mapToAdminUserResponse(
    user: UserWithRecipeCount,
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
      created_at: user.created_at,
      deleted_at: user.deleted_at ?? null,
    };
  }

  /**
   * Administrative member directory search and filtering.
   * Supports role, status, text search, and UserSort sorting criteria.
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

    let sort = query.sort;
    if (!sort) {
      sort = search ? UserSort.username_asc : UserSort.newest;
    }

    let orderBy: Prisma.UserOrderByWithRelationInput[];
    switch (sort) {
      case UserSort.username_asc:
        orderBy = [{ username: 'asc' }];
        break;
      case UserSort.username_desc:
        orderBy = [{ username: 'desc' }];
        break;
      case UserSort.recipes_count_desc:
        orderBy = [{ recipes: { _count: 'desc' } }, { username: 'asc' }];
        break;
      case UserSort.newest:
        orderBy = [{ created_at: 'desc' }, { id: 'desc' }];
        break;
      case UserSort.oldest:
        orderBy = [{ created_at: 'asc' }, { id: 'asc' }];
        break;
      default:
        orderBy = [{ created_at: 'desc' }, { id: 'desc' }];
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
            select: { recipes: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items: users.map((u) => this.mapToAdminUserResponse(u)),
      total,
      page,
      limit,
      total_pages: totalPages,
      has_next_page: page < totalPages,
      has_prev_page: page > 1,
    };
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
          select: { recipes: true },
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

    const isDeactivating =
      targetUser.status === UserStatus.active &&
      (dto.status === UserStatus.disabled || dto.status === UserStatus.banned);

    // Selective Session Eviction: only on password, role, or disabling status modification
    const shouldEvictSessions =
      dto.password !== undefined ||
      (dto.role !== undefined && dto.role !== targetUser.role) ||
      (dto.status !== undefined &&
        (dto.status === UserStatus.disabled ||
          dto.status === UserStatus.banned));

    const updatedUser = await this.prisma.$transaction(async (tx) => {
      if (isReactivating) {
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

      if (isDeactivating) {
        // Transfer public recipes to platform custody
        await tx.recipe.updateMany({
          where: { user_id: targetUserId },
          data: { owner_type: OwnerType.platform },
        });

        // Deactivate authored comments non-destructively
        await tx.comment.updateMany({
          where: { user_id: targetUserId },
          data: { is_active: false },
        });
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
        ...(isReactivating ? { deleted_at: null } : {}),
        ...(isDeactivating ? { deleted_at: new Date() } : {}),
      };

      return tx.user.update({
        where: { id: targetUserId },
        data: dataToUpdate,
        include: {
          _count: {
            select: { recipes: true },
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
      // Soft deletion lifecycle
      await this.prisma.$transaction(async (tx) => {
        // 1. Evict active sessions
        await tx.jwtSession.deleteMany({
          where: { id_user: targetUserId },
        });

        // 2. Transfer authored public recipes to platform custody
        await tx.recipe.updateMany({
          where: { user_id: targetUserId },
          data: { owner_type: OwnerType.platform },
        });

        // 3. Deactivate authored comments
        await tx.comment.updateMany({
          where: { user_id: targetUserId },
          data: { is_active: false },
        });

        // 4. Update user account status
        await tx.user.update({
          where: { id: targetUserId },
          data: {
            status: UserStatus.disabled,
            deleted_at: new Date(),
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
    const { relativePath } =
      await this.imageProcessingService.processAvatarFile(file);

    // Unlink old avatar file if present
    await this.safeUnlink(targetUser.avatar_url);

    // Save new avatar path in database
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { avatar_url: relativePath },
    });

    return { avatar_url: relativePath };
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
}
