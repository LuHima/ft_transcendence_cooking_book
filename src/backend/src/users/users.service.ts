import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OwnerType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserCookbookQueryDto } from './dto/user-cookbook-query.dto';
import { PaginatedRecipeResponseDto } from '../recipe/dto/recipe-response.dto';
import {
  RecipeProjection,
  RECIPE_SUMMARY_INCLUDE,
} from '../recipe/recipe.projection';
import { resolveStoredUploadPath } from '../common/config/upload-paths';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  FriendItemDto,
  PaginatedFriendsResponseDto,
} from '../friends/dto/friend-response.dto';
import { SearchUserQueryDto, UserSort } from './dto/search-user-query.dto';
import {
  UserSearchItemDto,
  PaginatedUsersResponseDto,
  PublicUserResponseDto,
  UserMessageResponseDto,
} from './dto/user-profile-response.dto';
import {
  BlockedUserItemDto,
  PaginatedBlockedUsersResponseDto,
} from './dto/blocked-user.dto';
import { ImageProcessingService } from '../common/services/image-processing.service';
import * as fs from 'fs';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private readonly recipeProjection: RecipeProjection,
    @Optional()
    private readonly imageProcessingService?: ImageProcessingService,
  ) {}

  async getUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    return user;
  }

  async getUserByUsername(
    username: string,
    currentUserId?: number,
  ): Promise<PublicUserResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        status: 'active',
        deleted_at: null,
      },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return await this.getUser(user.id, currentUserId);
  }

  async findUserByUsername(username: string) {
    return await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
      },
    });
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    return user;
  }

  async findUser(username: string) {
    return await this.prisma.user.findMany({
      where: {
        username: {
          contains: username,
          mode: 'insensitive',
        },
      },
      select: {
        username: true,
      },
    });
  }

  async findUsers(
    query: SearchUserQueryDto,
    currentUserId?: number,
  ): Promise<PaginatedUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const trimmedSearch =
      typeof query.search === 'string' ? query.search.trim() : undefined;
    const search =
      trimmedSearch && trimmedSearch.length > 0 ? trimmedSearch : undefined;

    let sort = query.sort;
    if (!sort) {
      sort = search ? UserSort.username_asc : UserSort.recipes_count_desc;
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
        orderBy = [{ recipes: { _count: 'desc' } }, { username: 'asc' }];
        break;
    }

    const blockedIds = currentUserId
      ? await this.getBlockedUserIds(currentUserId)
      : [];
    let idFilter: Prisma.IntFilter | undefined = undefined;
    if (currentUserId) {
      if (blockedIds.length > 0) {
        idFilter = { notIn: [currentUserId, ...blockedIds] };
      } else {
        idFilter = { not: currentUserId };
      }
    }

    const where: Prisma.UserWhereInput = {
      status: 'active',
      deleted_at: null,
      ...(idFilter ? { id: idFilter } : {}),
      ...(search
        ? {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { first_name: { contains: search, mode: 'insensitive' } },
              { last_name: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          username: true,
          avatar_url: true,
          first_name: true,
          last_name: true,
          created_at: true,
          _count: {
            select: {
              recipes: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const friendshipMap = new Map<
      number,
      'none' | 'pending_sent' | 'pending_received' | 'friends'
    >();

    if (currentUserId && users.length > 0) {
      const userIds = users.map((u) => u.id);
      const friendships = await this.prisma.friendship.findMany({
        where: {
          OR: [
            { requester_id: currentUserId, addressee_id: { in: userIds } },
            { requester_id: { in: userIds }, addressee_id: currentUserId },
          ],
        },
      });

      for (const f of friendships) {
        const otherUserId =
          f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
        if (f.status === 'accepted') {
          friendshipMap.set(otherUserId, 'friends');
        } else if (f.status === 'pending') {
          friendshipMap.set(
            otherUserId,
            f.requester_id === currentUserId
              ? 'pending_sent'
              : 'pending_received',
          );
        } else if (f.status === 'rejected') {
          friendshipMap.set(otherUserId, 'none');
        } else {
          friendshipMap.set(otherUserId, 'none');
        }
      }
    }

    const items: UserSearchItemDto[] = users.map((u) => ({
      id: u.id,
      username: u.username,
      avatar_url: u.avatar_url,
      first_name: u.first_name,
      last_name: u.last_name,
      created_at: u.created_at,
      recipes_count: u._count.recipes,
      friendship_status: currentUserId
        ? (friendshipMap.get(u.id) ?? 'none')
        : null,
    }));

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

  async getUser(
    id: number,
    currentUserId?: number,
  ): Promise<PublicUserResponseDto> {
    if (currentUserId) {
      const blockedIds = await this.getBlockedUserIds(currentUserId);
      if (blockedIds.includes(id)) {
        throw new NotFoundException('User not found');
      }
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: id,
        status: 'active',
        deleted_at: null,
      },
      select: {
        id: true,
        username: true,
        first_name: true,
        last_name: true,
        avatar_url: true,
        bio: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [recipesCount, friendsCount, totalLikesReceived] = await Promise.all([
      this.prisma.recipe.count({
        where: { user_id: id },
      }),
      this.prisma.friendship.count({
        where: {
          status: 'accepted',
          OR: [{ requester_id: id }, { addressee_id: id }],
        },
      }),
      this.prisma.like.count({
        where: { recipe: { user_id: id } },
      }),
    ]);

    let friendship_status:
      'none' | 'pending_sent' | 'pending_received' | 'friends' | null = null;

    if (currentUserId && currentUserId !== id) {
      const friendship = await this.prisma.friendship.findFirst({
        where: {
          OR: [
            { requester_id: currentUserId, addressee_id: id },
            { requester_id: id, addressee_id: currentUserId },
          ],
        },
      });

      if (!friendship) {
        friendship_status = 'none';
      } else if (friendship.status === 'accepted') {
        friendship_status = 'friends';
      } else if (friendship.status === 'pending') {
        if (friendship.requester_id === currentUserId) {
          friendship_status = 'pending_sent';
        } else {
          friendship_status = 'pending_received';
        }
      } else if (friendship.status === 'rejected') {
        friendship_status = 'none';
      } else {
        friendship_status = 'none';
      }
    }

    return {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      created_at: user.created_at,
      recipes_count: recipesCount,
      friends_count: friendsCount,
      total_likes_received: totalLikesReceived,
      friendship_status,
    };
  }

  async getUserFriends(
    targetUserId: number,
    query: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedFriendsResponseDto> {
    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, status: 'active', deleted_at: null },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const whereClause: Prisma.FriendshipWhereInput = {
      status: 'accepted',
      OR: [{ requester_id: targetUserId }, { addressee_id: targetUserId }],
    };

    const [friendships, total] = await Promise.all([
      this.prisma.friendship.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { updated_at: 'desc' },
        include: {
          requester: {
            select: { id: true, username: true, avatar_url: true },
          },
          addressee: {
            select: { id: true, username: true, avatar_url: true },
          },
        },
      }),
      this.prisma.friendship.count({ where: whereClause }),
    ]);

    const items: FriendItemDto[] = friendships.map((f) => {
      const friend =
        f.requester_id === targetUserId ? f.addressee : f.requester;
      return {
        id: friend.id,
        username: friend.username,
        avatar_url: friend.avatar_url,
        friends_since: f.updated_at,
      };
    });

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

  async getMe(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatar_url: true,
        bio: true,
        first_name: true,
        last_name: true,
        birth_date: true,
        phone: true,
        address: true,
        city: true,
        postal_code: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(id: number, updateUserDto: UpdateUserDto) {
    const data: Prisma.UserUpdateInput = { ...updateUserDto };
    if (updateUserDto.email !== undefined && updateUserDto.email !== null) {
      data.email = updateUserDto.email.trim().toLowerCase();
    }
    if (updateUserDto.birth_date !== undefined) {
      if (
        updateUserDto.birth_date === '' ||
        updateUserDto.birth_date === null
      ) {
        data.birth_date = null;
      } else {
        const parsedDate = new Date(updateUserDto.birth_date);
        if (isNaN(parsedDate.getTime())) {
          throw new BadRequestException('Invalid birth_date format');
        }
        data.birth_date = parsedDate;
      }
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatar_url: true,
          bio: true,
          first_name: true,
          last_name: true,
          birth_date: true,
          phone: true,
          address: true,
          city: true,
          postal_code: true,
          created_at: true,
        },
      });
      return updatedUser;
    } catch (error: any) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error?.code === 'P2002') {
        throw new ConflictException('Username or email already in use');
      }
      if (error?.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------

  private async safeUnlink(fileUrl: string | null | undefined): Promise<void> {
    if (!fileUrl) return;
    const localPath = resolveStoredUploadPath(fileUrl);
    if (!localPath) return;
    try {
      await fs.promises.unlink(localPath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        // Silently ignore non-critical unlinking errors
      }
    }
  }

  // ---------------------------------------------------------------------------

  async updateAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // Verify that the target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatar_url: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Process avatar image through Sharp WebP pipeline
    let avatarUrl: string;
    if (this.imageProcessingService) {
      const processed =
        await this.imageProcessingService.processAvatarFile(file);
      avatarUrl = processed.relativePath;
    } else {
      avatarUrl = `/uploads/avatars/${file.filename || file.originalname}`;
    }

    // Delete previously uploaded avatar file from disk if present
    await this.safeUnlink(user.avatar_url);

    // Persist the new avatar path
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar_url: avatarUrl },
    });

    return { avatar_url: avatarUrl };
  }

  // ---------------------------------------------------------------------------

  async deleteAvatar(userId: number): Promise<{ message: string }> {
    // Verify that the target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatar_url: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove the existing avatar file from disk if present
    await this.safeUnlink(user.avatar_url);

    // Set the avatar URL in database to null
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar_url: null },
    });

    return { message: 'Avatar deleted successfully' };
  }

  // ---------------------------------------------------------------------------

  async getLikedRecipes(
    userId: number,
    query: UserCookbookQueryDto = new UserCookbookQueryDto(),
  ): Promise<PaginatedRecipeResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [likes, total] = await Promise.all([
      this.prisma.like.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          recipe: {
            include: RECIPE_SUMMARY_INCLUDE(userId),
          },
        },
      }),
      this.prisma.like.count({
        where: { user_id: userId },
      }),
    ]);

    const recipes = likes.map((item) => ({
      ...item.recipe,
      is_liked: true,
    }));

    return this.recipeProjection.toPaginatedSummaryResponse(
      recipes,
      total,
      query,
      userId,
    );
  }

  // ---------------------------------------------------------------------------

  async getMyRecipes(
    userId: number,
    query: UserCookbookQueryDto = new UserCookbookQueryDto(),
  ): Promise<PaginatedRecipeResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [recipes, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where: { user_id: userId },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: RECIPE_SUMMARY_INCLUDE(userId),
      }),
      this.prisma.recipe.count({
        where: { user_id: userId },
      }),
    ]);

    return this.recipeProjection.toPaginatedSummaryResponse(
      recipes,
      total,
      query,
      userId,
    );
  }

  // ---------------------------------------------------------------------------

  async getUserPublicRecipes(
    targetUserId: number,
    query: UserCookbookQueryDto = new UserCookbookQueryDto(),
    currentUserId?: number,
  ): Promise<PaginatedRecipeResponseDto> {
    if (currentUserId) {
      const blockedIds = await this.getBlockedUserIds(currentUserId);
      if (blockedIds.includes(targetUserId)) {
        throw new NotFoundException('User not found');
      }
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, status: 'active', deleted_at: null },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [recipes, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where: { user_id: targetUserId, owner_type: OwnerType.user },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: RECIPE_SUMMARY_INCLUDE(currentUserId),
      }),
      this.prisma.recipe.count({
        where: { user_id: targetUserId, owner_type: OwnerType.user },
      }),
    ]);

    return this.recipeProjection.toPaginatedSummaryResponse(
      recipes,
      total,
      query,
      currentUserId,
    );
  }

  /**
   * Block another user account, dissolving any friendship and establishing mutual invisibility.
   */
  async blockUser(
    blockerId: number,
    targetId: number,
  ): Promise<UserMessageResponseDto> {
    if (blockerId === targetId) {
      throw new BadRequestException('Cannot block yourself');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: {
        id: targetId,
        status: 'active',
        deleted_at: null,
      },
      select: { id: true },
    });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    try {
      await this.prisma.userBlock.create({
        data: {
          blocker_id: blockerId,
          blocked_id: targetId,
        },
      });
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Idempotent block - record already exists
      } else {
        throw error;
      }
    }

    // Cascade Cleanup:
    // 1. Dissolve any Friendship record between the two users
    // 2. Delete any unread notifications exchanged between them
    await Promise.all([
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { requester_id: blockerId, addressee_id: targetId },
            { requester_id: targetId, addressee_id: blockerId },
          ],
        },
      }),
      this.prisma.notification.deleteMany({
        where: {
          is_read: false,
          OR: [
            { user_id: blockerId, actor_id: targetId },
            { user_id: targetId, actor_id: blockerId },
          ],
        },
      }),
    ]);

    return { message: 'User blocked successfully' };
  }

  /**
   * Remove a block on a user account.
   */
  async unblockUser(
    blockerId: number,
    targetId: number,
  ): Promise<UserMessageResponseDto> {
    const block = await this.prisma.userBlock.findUnique({
      where: {
        blocker_id_blocked_id: {
          blocker_id: blockerId,
          blocked_id: targetId,
        },
      },
    });
    if (!block) {
      throw new NotFoundException('User block not found');
    }

    await this.prisma.userBlock.delete({
      where: {
        blocker_id_blocked_id: {
          blocker_id: blockerId,
          blocked_id: targetId,
        },
      },
    });

    return { message: 'User unblocked successfully' };
  }

  /**
   * Retrieve all user IDs mutually blocked with the specified user.
   */
  async getBlockedUserIds(userId: number): Promise<number[]> {
    if (!this.prisma.userBlock) {
      return [];
    }
    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [{ blocker_id: userId }, { blocked_id: userId }],
      },
      select: {
        blocker_id: true,
        blocked_id: true,
      },
    });

    if (!blocks || !Array.isArray(blocks)) {
      return [];
    }

    const ids = new Set<number>();
    for (const b of blocks) {
      ids.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
    }
    return Array.from(ids);
  }

  /**
   * Retrieve paginated list of accounts currently blocked by the specified user.
   */
  async getBlockedUsers(
    userId: number,
    query: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedBlockedUsersResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserBlockWhereInput = {
      blocker_id: userId,
    };

    const [blocks, total] = await Promise.all([
      this.prisma.userBlock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          blocked: {
            select: {
              id: true,
              username: true,
              avatar_url: true,
            },
          },
        },
      }),
      this.prisma.userBlock.count({ where }),
    ]);

    const items: BlockedUserItemDto[] = blocks.map((b) => ({
      id: b.blocked.id,
      username: b.blocked.username,
      avatar_url: b.blocked.avatar_url,
      blocked_at: b.created_at,
    }));

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
}
