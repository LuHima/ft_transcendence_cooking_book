import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PaginatedRecipeResponseDto } from '../recipe/dto/recipe-response.dto';
import {
  RecipeProjection,
  RECIPE_SUMMARY_INCLUDE,
} from '../recipe/recipe.projection';
import { Prisma, RecipePrivacy, UserStatus } from '@prisma/client';

@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeProjection: RecipeProjection,
  ) {}

  /**
   * Retrieves a personalized, chronologically ordered activity feed of recipes
   * authored exclusively by confirmed friends of the authenticated user.
   *
   * Utilizes a two-step query architecture with zero-cost short-circuiting
   * for users without friends.
   *
   * @param userId Authenticated caller ID
   * @param query Pagination and localization query parameters
   * @returns Paginated recipe summary collection
   */
  async getFeed(
    userId: number,
    query: FeedQueryDto,
  ): Promise<PaginatedRecipeResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Step 1: Confirmed Friends Resolution
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requester_id: userId }, { addressee_id: userId }],
      },
      select: { requester_id: true, addressee_id: true },
    });

    const friendIds = friendships.map((f) =>
      f.requester_id === userId ? f.addressee_id : f.requester_id,
    );

    let activeFriendIds = friendIds;
    if (this.prisma.userBlock) {
      const userBlocks = await this.prisma.userBlock.findMany({
        where: {
          OR: [{ blocker_id: userId }, { blocked_id: userId }],
        },
        select: { blocker_id: true, blocked_id: true },
      });
      const blockedIds = new Set<number>();
      for (const b of userBlocks) {
        blockedIds.add(b.blocker_id === userId ? b.blocked_id : b.blocker_id);
      }
      activeFriendIds = friendIds.filter((id) => !blockedIds.has(id));
    }

    // Zero-Cost Short Circuit
    if (activeFriendIds.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
    }

    // Step 2: Friend Recipes Query
    const where: Prisma.RecipeWhereInput = {
      user_id: { in: activeFriendIds },
      is_active: true,
      privacy: { in: [RecipePrivacy.public, RecipePrivacy.friends_only] },
      user: {
        status: UserStatus.active,
        deleted_at: null,
      },
    };

    const [recipes, total] = await Promise.all([
      this.prisma.recipe.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: RECIPE_SUMMARY_INCLUDE(userId),
      }),
      this.prisma.recipe.count({ where }),
    ]);

    return this.recipeProjection.toPaginatedSummaryResponse(
      recipes,
      total,
      query,
      userId,
    );
  }
}
