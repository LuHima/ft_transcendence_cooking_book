import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PaginatedRecipeResponseDto } from '../recipe/dto/recipe-response.dto';
import {
  LocalizedRecipeSummaryResponse,
  LocalizedRecipeTagResponse,
} from '../recipe/dto/localized-recipe.response';
import { Prisma, UserStatus } from '@prisma/client';

type FeedRecipeItem = Prisma.RecipeGetPayload<{
  include: {
    translations: true;
    user: {
      select: {
        id: true;
        username: true;
        avatar_url: true;
      };
    };
    recipe_tags: {
      include: {
        tag: {
          include: {
            translations: true;
          };
        };
      };
    };
    _count: {
      select: {
        likes: true;
        comments: { where: { is_active: true } };
      };
    };
    likes: {
      select: {
        user_id: true;
      };
    };
  };
}>;

@Injectable()
export class FeedService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Zero-Cost Short Circuit
    if (friendIds.length === 0) {
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
    const where = {
      user_id: { in: friendIds },
      user: {
        status: UserStatus.active,
        deleted_at: null,
      },
    };

    const [recipes, total] = (await Promise.all([
      this.prisma.recipe.findMany({
        where,
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
          _count: {
            select: {
              likes: true,
              comments: { where: { is_active: true } },
            },
          },
          likes: {
            where: { user_id: userId },
            select: { user_id: true },
          },
        },
      }),
      this.prisma.recipe.count({ where }),
    ])) as [FeedRecipeItem[], number];

    // Step 3: Localization & Projection Mapping
    const lang = query.lang;
    const items: LocalizedRecipeSummaryResponse[] = recipes.map((recipe) => {
      const targetLocale =
        lang && (lang === 'it' || lang === 'en' || lang === 'fr')
          ? lang
          : recipe.source_lang;

      const translation =
        recipe.translations?.find((t) => t.locale === targetLocale) ??
        recipe.translations?.find((t) => t.locale === recipe.source_lang) ??
        recipe.translations?.find((t) => t.locale === 'en') ??
        recipe.translations?.[0];

      const resolved_lang = translation?.locale ?? recipe.source_lang;

      const tags: LocalizedRecipeTagResponse[] = (recipe.recipe_tags ?? []).map(
        (rt) => {
          const t = rt.tag;
          const tagTrans =
            t?.translations?.find((tr) => tr.locale === targetLocale) ??
            t?.translations?.find((tr) => tr.locale === recipe.source_lang) ??
            t?.translations?.find((tr) => tr.locale === 'en');
          return {
            id: t?.id ?? 0,
            slug: t?.slug ?? '',
            name: tagTrans?.name ?? t?.slug ?? '',
            resolved_lang: tagTrans?.locale ?? 'en',
          };
        },
      );

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
        available_languages: (recipe.translations ?? []).map((t) => t.locale),
      };
    });

    const total_pages = total === 0 ? 0 : Math.ceil(total / limit);

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
