import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserCookbookQueryDto } from './dto/user-cookbook-query.dto';
import { PaginatedRecipeResponseDto } from '../recipe/dto/recipe-response.dto';
import { LocalizedRecipeSummaryResponse } from '../recipe/dto/localized-recipe.response';
import { resolveStoredUploadPath } from '../common/config/upload-paths';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import {
  FriendItemDto,
  PaginatedFriendsResponseDto,
} from 'src/friends/dto/friend-response.dto';
import { SearchUserQueryDto, UserSort } from './dto/search-user-query.dto';
import {
  UserSearchItemDto,
  PaginatedUsersResponseDto,
} from './dto/user-profile-response.dto';
import * as fs from 'fs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    return user;
  }

  async getUserByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: username,
      },
    });
    return user;
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

    const where: Prisma.UserWhereInput = {
      status: 'active',
      deleted_at: null,
      ...(currentUserId ? { id: { not: currentUserId } } : {}),
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

  async getUser(id: number, currentUserId?: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
      select: {
        id: true,
        username: true,
        avatar_url: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    let friendship_status:
      | 'none'
      | 'pending_sent'
      | 'pending_received'
      | 'friends'
      | null = null;

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
      } else {
        friendship_status = 'none';
      }
    }

    return {
      ...user,
      friendship_status,
    };
  }

  async getUserFriends(
    targetUserId: number,
    query: PaginationQueryDto = new PaginationQueryDto(),
  ): Promise<PaginatedFriendsResponseDto> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
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

    // Delete previously uploaded avatar file from disk if present
    await this.safeUnlink(user.avatar_url);

    const avatarUrl = `/uploads/avatars/${file.filename || file.originalname}`;

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
            include: {
              translations: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar_url: true,
                },
              },
              recipe_tags: {
                include: {
                  tag: {
                    include: {
                      translations: true,
                    },
                  },
                },
              },
              _count: {
                select: {
                  likes: true,
                  comments: {
                    where: { is_active: true },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.like.count({
        where: { user_id: userId },
      }),
    ]);

    const items: LocalizedRecipeSummaryResponse[] = likes.map((item) => {
      const recipe = item.recipe;
      const targetLocale = query.lang;
      const translation =
        (targetLocale
          ? recipe.translations.find((t) => t.locale === targetLocale)
          : null) ??
        recipe.translations.find((t) => t.locale === recipe.source_lang) ??
        recipe.translations.find((t) => t.locale === 'en') ??
        recipe.translations[0];

      const resolved_lang = translation?.locale ?? (recipe.source_lang || 'en');

      const tags = (recipe.recipe_tags ?? []).map((rt: any) => {
        const t = rt.tag ?? rt;
        const tagTrans =
          t?.translations?.find(
            (tr: any) => tr.locale === (query.lang || recipe.source_lang),
          ) ??
          t?.translations?.find(
            (tr: any) => tr.locale === recipe.source_lang,
          ) ??
          t?.translations?.find((tr: any) => tr.locale === 'en');
        return {
          id: t.id,
          slug: t.slug,
          name: tagTrans?.name ?? t.slug,
          resolved_lang: tagTrans?.locale ?? 'en',
        };
      });

      return {
        id: recipe.id,
        course: recipe.course,
        difficulty: recipe.difficulty,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        total_time: recipe.total_time,
        servings: recipe.servings,
        source_lang: recipe.source_lang,
        translation_status: recipe.translation_status,
        cover_image_url: recipe.cover_image_url,
        video_url: recipe.video_url,
        created_at: recipe.created_at,
        updated_at: recipe.updated_at,
        author: recipe.user
          ? {
              id: recipe.user.id,
              username: recipe.user.username,
              avatar_url: recipe.user.avatar_url,
            }
          : null,
        title: translation?.title ?? '',
        description: translation?.description ?? '',
        tags,
        likes_count: recipe._count?.likes ?? 0,
        comments_count: recipe._count?.comments ?? 0,
        is_liked: true,
        resolved_lang,
        available_languages: recipe.translations.map((t) => t.locale),
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
        include: {
          translations: true,
          user: {
            select: {
              id: true,
              username: true,
              avatar_url: true,
            },
          },
          recipe_tags: {
            include: {
              tag: {
                include: {
                  translations: true,
                },
              },
            },
          },
          likes: {
            where: { user_id: userId },
            select: { user_id: true },
          },
          _count: {
            select: {
              likes: true,
              comments: {
                where: { is_active: true },
              },
            },
          },
        },
      }),
      this.prisma.recipe.count({
        where: { user_id: userId },
      }),
    ]);

    const items: LocalizedRecipeSummaryResponse[] = recipes.map(
      (recipe: any) => {
        const targetLocale = query.lang;
        const translation =
          (targetLocale
            ? recipe.translations.find((t) => t.locale === targetLocale)
            : null) ??
          recipe.translations.find((t) => t.locale === recipe.source_lang) ??
          recipe.translations.find((t) => t.locale === 'en') ??
          recipe.translations[0];

        const resolved_lang =
          translation?.locale ?? (recipe.source_lang || 'en');

        const tags = (recipe.recipe_tags ?? []).map((rt: any) => {
          const t = rt.tag ?? rt;
          const tagTrans =
            t?.translations?.find(
              (tr: any) => tr.locale === (query.lang || recipe.source_lang),
            ) ??
            t?.translations?.find(
              (tr: any) => tr.locale === recipe.source_lang,
            ) ??
            t?.translations?.find((tr: any) => tr.locale === 'en');
          return {
            id: t.id,
            slug: t.slug,
            name: tagTrans?.name ?? t.slug,
            resolved_lang: tagTrans?.locale ?? 'en',
          };
        });

        return {
          id: recipe.id,
          course: recipe.course,
          difficulty: recipe.difficulty,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          total_time: recipe.total_time,
          servings: recipe.servings,
          source_lang: recipe.source_lang,
          translation_status: recipe.translation_status,
          cover_image_url: recipe.cover_image_url,
          video_url: recipe.video_url,
          created_at: recipe.created_at,
          updated_at: recipe.updated_at,
          author: recipe.user
            ? {
                id: recipe.user.id,
                username: recipe.user.username,
                avatar_url: recipe.user.avatar_url,
              }
            : null,
          title: translation?.title ?? '',
          description: translation?.description ?? '',
          tags,
          likes_count: recipe._count?.likes ?? 0,
          comments_count: recipe._count?.comments ?? 0,
          is_liked: Boolean(recipe.likes && recipe.likes.length > 0),
          resolved_lang,
          available_languages: recipe.translations.map((t: any) => t.locale),
        };
      },
    );

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
