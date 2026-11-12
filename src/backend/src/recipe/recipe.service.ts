import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import {
  MediaType,
  OwnerType,
  RecipePrivacy,
  TranslationStatus,
  TranslationSource,
  NotificationSubject,
  NotificationAction,
  Role,
  ReportSubject,
  ReportStatus,
  Prisma,
} from '@prisma/client';
import { NotificationEmit } from 'src/notifications/notification-emit';
import {
  AdminRecipeQueryDto,
  AdminRecipeStatus,
} from '../admin/dto/admin-recipe-query.dto';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import {
  FilterRecipeDto,
  RecipeSortBy,
  RecipeSortOrder,
} from './dto/filter-recipe.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { DeleteCommentQueryDto } from './dto/delete-comment-query.dto';
import { DeleteRecipeQueryDto } from './dto/delete-recipe-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  ThreadedRecipeCommentResponseDto,
  PaginatedRecipeCommentRepliesResponseDto,
  PaginatedRecipeCommentsResponseDto,
  RecipeCommentResponseDto,
} from './dto/comment-response.dto';
import {
  RecipeCommentQueryDto,
  RecipeCommentSortBy,
} from './dto/recipe-comment-query.dto';
import { getPendingCommentReportTargetIds } from '../reports/helpers/pending-reports.helper';
import { SortOrder } from '../common/dto/sort-order.enum';
import { LocalizedRecipeDetailResponse } from './dto/localized-recipe.response';
import { PaginatedRecipeResponseDto } from './dto/recipe-response.dto';
import {
  RecipeProjection,
  RECIPE_SUMMARY_INCLUDE,
  RECIPE_DETAIL_INCLUDE,
} from './recipe.projection';
import { ProductionConfig } from '../common/config/production.config';
import {
  RECIPE_UPLOADS_DIR,
  resolveStoredUploadPath,
} from '../common/config/upload-paths';
import {
  ImageProcessingService,
  ProcessedMediaResult,
} from '../common/services/image-processing.service';
import { VideoProcessingService } from '../common/services/video-processing.service';
import * as fs from 'fs';
import { join } from 'path';
import { createHttpException, errors } from 'src/common/config/error.config';

@Injectable()
export class RecipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly translationService: TranslationService,
    private readonly productionConfig: ProductionConfig,
    private readonly notificationEmit: NotificationEmit,
    private readonly recipeProjection: RecipeProjection,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly videoProcessingService: VideoProcessingService,
  ) {}

  private readonly logger = new Logger(RecipeService.name);

  public logAudit(
    event:
      | 'ADMIN_PRIVATE_RECIPE_INSPECT'
      | 'MODERATOR_PRIVATE_RECIPE_CONTEXT_INSPECT',
    details: { userId?: number; recipeId: number; reportId?: number },
  ) {
    this.logger.log(
      `[${event}] User #${details.userId} inspected private recipe #${details.recipeId}${
        details.reportId ? ` for report #${details.reportId}` : ''
      }`,
    );
  }

  private async resolveCaller(
    currentUserOrId?: number | { id: number; role?: Role | string },
    roleOverride?: Role | string,
  ): Promise<{ currentUserId?: number; currentUserRole?: Role | string }> {
    const currentUserId =
      typeof currentUserOrId === 'number'
        ? currentUserOrId
        : currentUserOrId?.id;
    let currentUserRole =
      roleOverride ??
      (typeof currentUserOrId === 'object'
        ? currentUserOrId?.role
        : undefined);

    if (!currentUserRole && currentUserId && this.prisma.user?.findUnique) {
      const caller = await this.prisma.user.findUnique({
        where: { id: currentUserId },
        select: { role: true },
      });
      currentUserRole = caller?.role;
    }

    return { currentUserId, currentUserRole };
  }

  // ---------------------------------------------------------------------------

  private applyCatalogFilters(
    filterDto: FilterRecipeDto,
    where: Prisma.RecipeWhereInput,
    andConditions: Prisma.RecipeWhereInput[],
  ): void {
    if (filterDto.course) {
      where.course = filterDto.course;
    }

    if (filterDto.difficulty) {
      where.difficulty = filterDto.difficulty;
    }

    if (filterDto.author_id) {
      where.user_id = filterDto.author_id;
    }

    if (filterDto.min_time !== undefined || filterDto.max_time !== undefined) {
      where.total_time = {
        ...(filterDto.min_time !== undefined
          ? { gte: filterDto.min_time }
          : {}),
        ...(filterDto.max_time !== undefined
          ? { lte: filterDto.max_time }
          : {}),
      };
    }

    if (filterDto.max_prep_time !== undefined) {
      where.prep_time = { lte: filterDto.max_prep_time };
    }

    if (filterDto.source_lang) {
      where.source_lang = filterDto.source_lang;
    }

    if (filterDto.curated_only && filterDto.lang) {
      andConditions.push({
        translations: {
          some: {
            locale: filterDto.lang,
            translation_source: {
              in: [TranslationSource.author_original, TranslationSource.manual],
            },
          },
        },
      });
    }

    if (filterDto.tag_ids && filterDto.tag_ids.length > 0) {
      const mode = filterDto.tag_mode || 'all';
      if (mode === 'any') {
        andConditions.push({
          recipe_tags: {
            some: {
              tag_id: { in: filterDto.tag_ids },
            },
          },
        });
      } else {
        for (const tagId of filterDto.tag_ids) {
          andConditions.push({
            recipe_tags: {
              some: {
                tag_id: tagId,
              },
            },
          });
        }
      }
    }

    if (filterDto.exclude_tag_ids && filterDto.exclude_tag_ids.length > 0) {
      andConditions.push({
        recipe_tags: {
          none: {
            tag_id: { in: filterDto.exclude_tag_ids },
          },
        },
      });
    }

    if (filterDto.ingredient_ids && filterDto.ingredient_ids.length > 0) {
      const mode = filterDto.ingredient_mode || 'all';
      if (mode === 'any') {
        andConditions.push({
          recipe_ingredients: {
            some: {
              ingredient_id: { in: filterDto.ingredient_ids },
            },
          },
        });
      } else {
        for (const ingredientId of filterDto.ingredient_ids) {
          andConditions.push({
            recipe_ingredients: {
              some: {
                ingredient_id: ingredientId,
              },
            },
          });
        }
      }
    }

    if (
      filterDto.exclude_ingredient_ids &&
      filterDto.exclude_ingredient_ids.length > 0
    ) {
      andConditions.push({
        recipe_ingredients: {
          none: {
            ingredient_id: { in: filterDto.exclude_ingredient_ids },
          },
        },
      });
    }

    if (filterDto.search && filterDto.search.trim() !== '') {
      const keyword = filterDto.search.trim();
      andConditions.push({
        translations: {
          some: {
            OR: [
              { title: { contains: keyword, mode: 'insensitive' } },
              { description: { contains: keyword, mode: 'insensitive' } },
            ],
          },
        },
      });
    }
  }

  private buildRecipeWhere(
    filterDto: FilterRecipeDto,
    currentUserId?: number,
    friendIds: number[] = [],
    blockedIds: number[] = [],
  ): Prisma.RecipeWhereInput {
    const where: Prisma.RecipeWhereInput = {
      is_active: true,
    };

    const andConditions: Prisma.RecipeWhereInput[] = [];

    if (!currentUserId) {
      where.privacy = RecipePrivacy.public;
    } else {
      const privacyOr: Prisma.RecipeWhereInput[] = [
        { privacy: RecipePrivacy.public },
        { user_id: currentUserId },
      ];
      if (friendIds.length > 0) {
        privacyOr.push({
          privacy: RecipePrivacy.friends_only,
          user_id: { in: friendIds },
        });
      }
      andConditions.push({ OR: privacyOr });
    }

    if (blockedIds.length > 0) {
      andConditions.push({
        OR: [
          { user_id: null },
          { user_id: { notIn: blockedIds } },
        ],
      });
    }

    this.applyCatalogFilters(filterDto, where, andConditions);

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  private resolveRecipeOrderBy(
    sortBy: RecipeSortBy = RecipeSortBy.created_at,
    sortOrder?: RecipeSortOrder,
  ): Prisma.RecipeOrderByWithRelationInput {
    let order: Prisma.SortOrder;
    if (sortOrder) {
      order = sortOrder as Prisma.SortOrder;
    } else {
      order =
        sortBy === RecipeSortBy.created_at || sortBy === RecipeSortBy.likes_count
          ? 'desc'
          : 'asc';
    }

    switch (sortBy) {
      case RecipeSortBy.total_time:
        return { total_time: order };
      case RecipeSortBy.difficulty:
        return { difficulty: order };
      case RecipeSortBy.likes_count:
        return { likes: { _count: order } };
      case RecipeSortBy.created_at:
      default:
        return { created_at: order };
    }
  }

  private buildCatalogSqlFilters(filterDto: FilterRecipeDto): Prisma.Sql[] {
    const sqlConditions: Prisma.Sql[] = [];

    if (filterDto.course) {
      sqlConditions.push(
        Prisma.sql`r.course = ${filterDto.course}::"Course"`,
      );
    }

    if (filterDto.difficulty) {
      sqlConditions.push(
        Prisma.sql`r.difficulty = ${filterDto.difficulty}::"RecipeDifficulty"`,
      );
    }

    if (filterDto.author_id) {
      sqlConditions.push(Prisma.sql`r.user_id = ${filterDto.author_id}`);
    }

    if (filterDto.min_time !== undefined) {
      sqlConditions.push(Prisma.sql`r.total_time >= ${filterDto.min_time}`);
    }

    if (filterDto.max_time !== undefined) {
      sqlConditions.push(Prisma.sql`r.total_time <= ${filterDto.max_time}`);
    }

    if (filterDto.max_prep_time !== undefined) {
      sqlConditions.push(
        Prisma.sql`r.prep_time <= ${filterDto.max_prep_time}`,
      );
    }

    if (filterDto.source_lang) {
      sqlConditions.push(Prisma.sql`r.source_lang = ${filterDto.source_lang}`);
    }

    if (filterDto.curated_only && filterDto.lang) {
      sqlConditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM recipe_translations rt_curated
          WHERE rt_curated.recipe_id = r.id
            AND rt_curated.locale = ${filterDto.lang}
            AND rt_curated.translation_source IN ('author_original', 'manual')
        )`,
      );
    }

    if (filterDto.tag_ids && filterDto.tag_ids.length > 0) {
      const mode = filterDto.tag_mode || 'all';
      if (mode === 'any') {
        sqlConditions.push(
          Prisma.sql`EXISTS (
            SELECT 1 FROM recipe_tags rt
            WHERE rt.recipe_id = r.id AND rt.tag_id IN (${Prisma.join(filterDto.tag_ids)})
          )`,
        );
      } else {
        for (const tagId of filterDto.tag_ids) {
          sqlConditions.push(
            Prisma.sql`EXISTS (
              SELECT 1 FROM recipe_tags rt
              WHERE rt.recipe_id = r.id AND rt.tag_id = ${tagId}
            )`,
          );
        }
      }
    }

    if (filterDto.exclude_tag_ids && filterDto.exclude_tag_ids.length > 0) {
      sqlConditions.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1 FROM recipe_tags rt
          WHERE rt.recipe_id = r.id AND rt.tag_id IN (${Prisma.join(filterDto.exclude_tag_ids)})
        )`,
      );
    }

    if (filterDto.ingredient_ids && filterDto.ingredient_ids.length > 0) {
      const mode = filterDto.ingredient_mode || 'all';
      if (mode === 'any') {
        sqlConditions.push(
          Prisma.sql`EXISTS (
            SELECT 1 FROM recipe_ingredients ri
            WHERE ri.recipe_id = r.id AND ri.ingredient_id IN (${Prisma.join(filterDto.ingredient_ids)})
          )`,
        );
      } else {
        for (const ingredientId of filterDto.ingredient_ids) {
          sqlConditions.push(
            Prisma.sql`EXISTS (
              SELECT 1 FROM recipe_ingredients ri
              WHERE ri.recipe_id = r.id AND ri.ingredient_id = ${ingredientId}
            )`,
          );
        }
      }
    }

    if (
      filterDto.exclude_ingredient_ids &&
      filterDto.exclude_ingredient_ids.length > 0
    ) {
      sqlConditions.push(
        Prisma.sql`NOT EXISTS (
          SELECT 1 FROM recipe_ingredients ri
          WHERE ri.recipe_id = r.id AND ri.ingredient_id IN (${Prisma.join(filterDto.exclude_ingredient_ids)})
        )`,
      );
    }

    if (filterDto.search && filterDto.search.trim() !== '') {
      const pattern = `%${filterDto.search.trim()}%`;
      sqlConditions.push(
        Prisma.sql`EXISTS (
          SELECT 1 FROM recipe_translations rt_search
          WHERE rt_search.recipe_id = r.id
            AND (rt_search.title ILIKE ${pattern} OR rt_search.description ILIKE ${pattern})
        )`,
      );
    }

    return sqlConditions;
  }

  private async resolveRecipesSortedByTitle(
    filterDto: FilterRecipeDto,
    where: Prisma.RecipeWhereInput,
    skip: number,
    limit: number,
    currentUserId?: number,
    friendIds: number[] = [],
    blockedIds: number[] = [],
    customBaseSqlConditions?: Prisma.Sql[],
  ): Promise<{ recipes: any[]; total: number }> {
    const targetLocale = filterDto.lang || null;
    const sortOrder =
      filterDto.sort_order === RecipeSortOrder.desc ? 'desc' : 'asc';
    const orderSql =
      sortOrder === 'desc' ? Prisma.sql`DESC` : Prisma.sql`ASC`;

    let sqlConditions: Prisma.Sql[];
    if (customBaseSqlConditions) {
      sqlConditions = [...customBaseSqlConditions];
    } else {
      sqlConditions = [Prisma.sql`r.is_active = true`];

      if (!currentUserId) {
        sqlConditions.push(Prisma.sql`r.privacy = 'public'::"RecipePrivacy"`);
      } else {
        if (friendIds.length > 0) {
          sqlConditions.push(
            Prisma.sql`(r.privacy = 'public'::"RecipePrivacy" OR r.user_id = ${currentUserId} OR (r.privacy = 'friends_only'::"RecipePrivacy" AND r.user_id IN (${Prisma.join(friendIds)})))`,
          );
        } else {
          sqlConditions.push(
            Prisma.sql`(r.privacy = 'public'::"RecipePrivacy" OR r.user_id = ${currentUserId})`,
          );
        }
      }

      if (blockedIds.length > 0) {
        sqlConditions.push(
          Prisma.sql`(r.user_id IS NULL OR r.user_id NOT IN (${Prisma.join(blockedIds)}))`,
        );
      }
    }

    sqlConditions.push(...this.buildCatalogSqlFilters(filterDto));

    const whereSql = Prisma.join(sqlConditions, ' AND ');

    const [rawRows, total] = await Promise.all([
      this.prisma.$queryRaw<{ id: number }[]>`
        SELECT r.id
        FROM recipes r
        LEFT JOIN recipe_translations t_target ON (t_target.recipe_id = r.id AND t_target.locale = ${targetLocale})
        LEFT JOIN recipe_translations t_source ON (t_source.recipe_id = r.id AND t_source.locale = r.source_lang)
        LEFT JOIN recipe_translations t_en ON (t_en.recipe_id = r.id AND t_en.locale = 'en')
        WHERE ${whereSql}
        ORDER BY LOWER(COALESCE(t_target.title, t_source.title, t_en.title)) ${orderSql}, r.id ${orderSql}
        LIMIT ${limit} OFFSET ${skip}
      `,
      this.prisma.recipe.count({ where }),
    ]);

    const ids = rawRows.map((row) => row.id);
    let recipes: any[] = [];
    if (ids.length > 0) {
      const hydrated = await this.prisma.recipe.findMany({
        where: { id: { in: ids } },
        include: RECIPE_SUMMARY_INCLUDE(currentUserId),
      });
      const recipeMap = new Map(hydrated.map((r) => [r.id, r]));
      recipes = ids.map((id) => recipeMap.get(id)).filter(Boolean);
    }

    return { recipes, total };
  }

  public async getAllRecipe(
    filters?: FilterRecipeDto | string,
    currentUserId?: number,
  ): Promise<PaginatedRecipeResponseDto> {
    const filterDto: FilterRecipeDto =
      typeof filters === 'string' ? { lang: filters as any } : filters || {};

    const page = Number(filterDto.page) > 0 ? Number(filterDto.page) : 1;
    const limit =
      Number(filterDto.limit) > 0 ? Math.min(Number(filterDto.limit), 100) : 20;
    const skip = (page - 1) * limit;

    let friendIds: number[] = [];
    let blockedIds: number[] = [];

    if (currentUserId) {
      const [friendships, userBlocks] = await Promise.all([
        this.prisma.friendship?.findMany
          ? this.prisma.friendship.findMany({
              where: {
                status: 'accepted',
                OR: [
                  { requester_id: currentUserId },
                  { addressee_id: currentUserId },
                ],
              },
              select: { requester_id: true, addressee_id: true },
            })
          : Promise.resolve([]),
        this.prisma.userBlock?.findMany
          ? this.prisma.userBlock.findMany({
              where: {
                OR: [
                  { blocker_id: currentUserId },
                  { blocked_id: currentUserId },
                ],
              },
              select: { blocker_id: true, blocked_id: true },
            })
          : Promise.resolve([]),
      ]);

      if (friendships && Array.isArray(friendships)) {
        friendIds = friendships.map((f) =>
          f.requester_id === currentUserId ? f.addressee_id : f.requester_id,
        );
      }

      if (userBlocks && Array.isArray(userBlocks)) {
        const blockedSet = new Set<number>();
        for (const b of userBlocks) {
          blockedSet.add(
            b.blocker_id === currentUserId ? b.blocked_id : b.blocker_id,
          );
        }
        blockedIds = Array.from(blockedSet);
      }
    }

    const where = this.buildRecipeWhere(
      filterDto,
      currentUserId,
      friendIds,
      blockedIds,
    );

    let recipes: any[];
    let total: number;

    if (filterDto.sort_by === RecipeSortBy.title) {
      const titleResult = await this.resolveRecipesSortedByTitle(
        filterDto,
        where,
        skip,
        limit,
        currentUserId,
        friendIds,
        blockedIds,
      );
      recipes = titleResult.recipes;
      total = titleResult.total;
    } else {
      const orderBy = this.resolveRecipeOrderBy(
        filterDto.sort_by,
        filterDto.sort_order,
      );

      [recipes, total] = await Promise.all([
        this.prisma.recipe.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: RECIPE_SUMMARY_INCLUDE(currentUserId),
        }),
        this.prisma.recipe.count({
          where,
        }),
      ]);
    }

    return this.recipeProjection.toPaginatedSummaryResponse(
      recipes,
      total,
      { ...filterDto, page, limit },
      currentUserId,
    );
  }

  // ---------------------------------------------------------------------------

  public async getAdminRecipes(
    query: AdminRecipeQueryDto,
    caller: { id: number; role?: Role | string },
  ): Promise<PaginatedRecipeResponseDto> {
    const callerRole = String(caller?.role || '');
    if (callerRole !== Role.admin && callerRole !== Role.moderator) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit =
      Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RecipeWhereInput = {};
    const andConditions: Prisma.RecipeWhereInput[] = [];
    const customBaseSqlConditions: Prisma.Sql[] = [];

    // 1. Status lifecycle filter
    if (query.status === AdminRecipeStatus.active) {
      where.is_active = true;
      customBaseSqlConditions.push(Prisma.sql`r.is_active = true`);
    } else if (query.status === AdminRecipeStatus.inactive) {
      where.is_active = false;
      customBaseSqlConditions.push(Prisma.sql`r.is_active = false`);
    }

    // 2. Role-scoped visibility scoping per ADR 0027 & privacy-and-visibility-matrix
    // Administrator: view all privacy tiers (public, friends_only, private)
    // Moderator: view public + friends_only, and private ONLY IF an active pending report exists against the recipe (or its comments)
    if (callerRole === Role.moderator) {
      let allowedPrivateRecipeIds: number[] = [];
      if (this.prisma.report) {
        const recipeReports = await this.prisma.report.findMany({
          where: {
            status: ReportStatus.pending,
            subject: ReportSubject.recipe,
          },
          select: { target_id: true },
        });
        const reportedRecipeIds = recipeReports.map((r) => r.target_id);

        let commentRecipeIds: number[] = [];
        if (this.prisma.comment) {
          const reportedCommentIds = await getPendingCommentReportTargetIds(
            this.prisma,
          );
          if (reportedCommentIds.length > 0) {
            const reportedComments = await this.prisma.comment.findMany({
              where: { id: { in: reportedCommentIds } },
              select: { recipe_id: true },
            });
            commentRecipeIds = reportedComments.map((c) => c.recipe_id);
          }
        }

        allowedPrivateRecipeIds = Array.from(
          new Set([...reportedRecipeIds, ...commentRecipeIds]),
        );
      }

      const privacyOr: Prisma.RecipeWhereInput[] = [
        { privacy: RecipePrivacy.public },
        { privacy: RecipePrivacy.friends_only },
      ];
      if (caller?.id) {
        privacyOr.push({ user_id: caller.id });
      }
      if (allowedPrivateRecipeIds.length > 0) {
        privacyOr.push({
          privacy: RecipePrivacy.private,
          id: { in: allowedPrivateRecipeIds },
        });
      }
      andConditions.push({ OR: privacyOr });

      if (allowedPrivateRecipeIds.length > 0) {
        if (caller?.id) {
          customBaseSqlConditions.push(
            Prisma.sql`(r.privacy IN ('public'::"RecipePrivacy", 'friends_only'::"RecipePrivacy") OR r.user_id = ${caller.id} OR (r.privacy = 'private'::"RecipePrivacy" AND r.id IN (${Prisma.join(allowedPrivateRecipeIds)})))`,
          );
        } else {
          customBaseSqlConditions.push(
            Prisma.sql`(r.privacy IN ('public'::"RecipePrivacy", 'friends_only'::"RecipePrivacy") OR (r.privacy = 'private'::"RecipePrivacy" AND r.id IN (${Prisma.join(allowedPrivateRecipeIds)})))`,
          );
        }
      } else {
        if (caller?.id) {
          customBaseSqlConditions.push(
            Prisma.sql`(r.privacy IN ('public'::"RecipePrivacy", 'friends_only'::"RecipePrivacy") OR r.user_id = ${caller.id})`,
          );
        } else {
          customBaseSqlConditions.push(
            Prisma.sql`r.privacy IN ('public'::"RecipePrivacy", 'friends_only'::"RecipePrivacy")`,
          );
        }
      }
    } else {
      if (customBaseSqlConditions.length === 0) {
        customBaseSqlConditions.push(Prisma.sql`1=1`);
      }
    }

    this.applyCatalogFilters(query, where, andConditions);

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    let recipes: any[];
    let total: number;

    if (query.sort_by === RecipeSortBy.title) {
      const titleResult = await this.resolveRecipesSortedByTitle(
        query,
        where,
        skip,
        limit,
        caller.id,
        [],
        [],
        customBaseSqlConditions,
      );
      recipes = titleResult.recipes;
      total = titleResult.total;
    } else {
      const orderBy = this.resolveRecipeOrderBy(
        query.sort_by,
        query.sort_order,
      );

      [recipes, total] = await Promise.all([
        this.prisma.recipe.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: RECIPE_SUMMARY_INCLUDE(caller.id),
        }),
        this.prisma.recipe.count({
          where,
        }),
      ]);
    }

    return this.recipeProjection.toPaginatedSummaryResponse(
      recipes,
      total,
      { ...query, page, limit },
      caller.id,
    );
  }

  // ---------------------------------------------------------------------------

  /* 
  GET /api/recipes/:id?lang=it|en|fr
  */
  async getRecipeById(
    id: number,
    lang?: string,
    currentUserOrId?: number | { id: number; role?: Role | string },
    roleOverride?: Role | string,
  ): Promise<LocalizedRecipeDetailResponse> {
    const { currentUserId, currentUserRole } = await this.resolveCaller(
      currentUserOrId,
      roleOverride,
    );

    // Fetch the recipe from database, joining it with its translations
    const recipe: any = await this.prisma.recipe.findUnique({
      where: {
        id: id,
      },
      include: RECIPE_DETAIL_INCLUDE(currentUserId),
    });

    // If recipe is not found -> throw 404 Not Found
    if (!recipe) throw new NotFoundException('Recipe not found');

    const isAuthor =
      currentUserId !== undefined &&
      recipe.user_id !== null &&
      recipe.user_id === currentUserId;

    const isStaff =
      currentUserRole === Role.admin || currentUserRole === Role.moderator;

    if (recipe.is_active === false) {
      if (!isAuthor && !isStaff) {
        throw new NotFoundException('Recipe not found');
      }
    }

    // Mutual User Block Invariant
    if (
      currentUserId &&
      recipe.user_id &&
      currentUserId !== recipe.user_id &&
      this.prisma.userBlock
    ) {
      const block = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blocker_id: currentUserId, blocked_id: recipe.user_id },
            { blocker_id: recipe.user_id, blocked_id: currentUserId },
          ],
        },
      });
      if (block) {
        throw new NotFoundException('Recipe not found');
      }
    }

    // Privacy Access Control
    const privacy = recipe.privacy ?? RecipePrivacy.public;

    if (privacy === RecipePrivacy.private) {
      if (isAuthor) {
        // Author can view own private recipe
      } else if (currentUserRole === Role.admin) {
        this.logAudit('ADMIN_PRIVATE_RECIPE_INSPECT', {
          userId: currentUserId,
          recipeId: recipe.id,
        });
      } else if (currentUserRole === Role.moderator) {
        let hasActiveReport: any = null;
        if (this.prisma.report) {
          const recipeComments = this.prisma.comment
            ? await this.prisma.comment.findMany({
                where: { recipe_id: recipe.id },
                select: { id: true },
              })
            : [];
          const commentIds = recipeComments.map((c) => c.id);

          hasActiveReport = await this.prisma.report.findFirst({
            where: {
              status: 'pending',
              OR: [
                { subject: 'recipe', target_id: recipe.id },
                ...(commentIds.length > 0
                  ? [
                      {
                        subject: 'comment' as const,
                        target_id: { in: commentIds },
                      },
                    ]
                  : []),
              ],
            },
          });
        }
        if (hasActiveReport) {
          this.logAudit('MODERATOR_PRIVATE_RECIPE_CONTEXT_INSPECT', {
            userId: currentUserId,
            recipeId: recipe.id,
            reportId: hasActiveReport.id,
          });
        } else {
          throw new NotFoundException('Recipe not found');
        }
      } else {
        throw new NotFoundException('Recipe not found');
      }
    } else if (privacy === RecipePrivacy.friends_only) {
      if (!currentUserId) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (isAuthor || isStaff) {
        // Author and staff can view friends_only recipe
      } else {
        let isFriend = false;
        if (this.prisma.friendship && recipe.user_id) {
          const friendship = await this.prisma.friendship.findFirst({
            where: {
              status: 'accepted',
              OR: [
                { requester_id: currentUserId, addressee_id: recipe.user_id },
                { requester_id: recipe.user_id, addressee_id: currentUserId },
              ],
            },
          });
          isFriend = Boolean(friendship);
        }
        if (!isFriend) {
          throw new ForbiddenException(
            'This recipe is only visible to confirmed friends of the author',
          );
        }
      }
    }

    return this.recipeProjection.toLocalizedDetail(recipe, lang, currentUserId);
  }

  // ---------------------------------------------------------------------------

  /* 
  POST /api/recipes
  */
  async createRecipe(recipe: CreateRecipeDto, userId: number) {
    // Check if there are duplicate step numbers
    const stepNumbers = recipe.steps.map((step) => step.step_number);
    const uniqueStepNumbers = new Set(stepNumbers);
    if (uniqueStepNumbers.size !== stepNumbers.length) {
      const duplicateStepNumber = stepNumbers.find(
        (stepNumber, index) => stepNumbers.indexOf(stepNumber) !== index,
      );
      throw new BadRequestException(
        `Duplicate step number: ${duplicateStepNumber}. Each step number must be unique.`,
      );
    }

    // Check if steps numbers are not consecutive
    const sortedStepNumbers = [...stepNumbers].sort((a, b) => a - b);
    const missingStepIndex = sortedStepNumbers.findIndex(
      (stepNumber, index) => stepNumber !== index + 1,
    );
    if (missingStepIndex !== -1) {
      const missingStepNumber = missingStepIndex + 1;
      throw new BadRequestException(
        `Step numbers must be consecutive starting at 1. Missing step number: ${missingStepNumber}.`,
      );
    }

    // Check if there are duplicate ingredients
    const ingredientIds = recipe.ingredients.map(
      (ingredient) => ingredient.ingredient_id,
    );
    const uniqueIngredientIds = new Set(ingredientIds);
    if (uniqueIngredientIds.size !== ingredientIds.length) {
      const duplicateIngredientId = ingredientIds.find(
        (ingredientId, index) => ingredientIds.indexOf(ingredientId) !== index,
      );
      throw new BadRequestException(
        `Duplicate ingredient ID: ${duplicateIngredientId}. Each ingredient may only be added once.`,
      );
    }

    // Check if there are duplicate tags
    const tagIds = recipe.tag_ids ?? [];
    const uniqueTagIds = new Set(tagIds);
    if (uniqueTagIds.size !== tagIds.length) {
      const duplicateTagId = tagIds.find(
        (tagId, index) => tagIds.indexOf(tagId) !== index,
      );
      throw new BadRequestException(
        `Duplicate tag ID: ${duplicateTagId}. Each tag may only be added once.`,
      );
    }

    // Language verification
    const textToVerify = [
      recipe.title,
      recipe.description,
      ...recipe.steps.map((s) => s.description),
    ].join(' ');
    await this.translationService.verifySourceLanguage(
      textToVerify,
      recipe.source_lang,
    );

    // Validate catalog references (verify ingredients and tags exist)
    const requestedIngredientIds = Array.from(
      new Set(recipe.ingredients.map((i) => i.ingredient_id)),
    );
    const existingIngredients = await this.prisma.ingredient.findMany({
      where: { id: { in: requestedIngredientIds } },
      select: { id: true },
    });
    const existingIngredientIds = new Set(existingIngredients.map((i) => i.id));
    for (const id of requestedIngredientIds) {
      if (!existingIngredientIds.has(id)) {
        throw new BadRequestException(
          `Ingredient with ID ${id} does not exist in catalog`,
        );
      }
    }
    if (recipe.tag_ids && recipe.tag_ids.length > 0) {
      const requestedTagIds = Array.from(new Set(recipe.tag_ids));
      const existingTags = await this.prisma.tag.findMany({
        where: { id: { in: requestedTagIds } },
        select: { id: true },
      });
      const existingTagIds = new Set(existingTags.map((t) => t.id));
      for (const id of requestedTagIds) {
        if (!existingTagIds.has(id)) {
          throw new BadRequestException(
            `Tag with ID ${id} does not exist in catalog`,
          );
        }
      }
    }

    // Prepare text payload for batch translation
    const allLocales = ['it', 'en', 'fr'];
    const targetLocales = allLocales.filter((l) => l !== recipe.source_lang);
    const textsToTranslate: string[] = [
      recipe.title,
      recipe.description,
      recipe.preservation ?? '',
      recipe.tips ?? '',
    ];
    for (const step of recipe.steps) {
      textsToTranslate.push(step.title ?? '');
      textsToTranslate.push(step.description);
    }

    // Translate across target locales
    let overallTranslationSuccess = true;
    const translationsByLocale: Record<
      string,
      {
        title: string;
        description: string;
        preservation?: string | null;
        tips?: string | null;
        steps: Array<{ title?: string | null; description: string }>;
      }
    > = {};

    // Source locale translation
    translationsByLocale[recipe.source_lang] = {
      title: recipe.title,
      description: recipe.description,
      preservation: recipe.preservation ?? null,
      tips: recipe.tips ?? null,
      steps: recipe.steps.map((s) => ({
        title: s.title ?? null,
        description: s.description,
      })),
    };

    for (const targetLang of targetLocales) {
      const res = await this.translationService.translateBatch(
        textsToTranslate,
        recipe.source_lang,
        targetLang,
      );
      if (!res.success) {
        overallTranslationSuccess = false;
      } else {
        const [transTitle, transDesc, transPres, transTips, ...stepTexts] =
          res.translations;
        const translatedSteps: Array<{
          title?: string | null;
          description: string;
        }> = [];
        for (let i = 0; i < recipe.steps.length; i++) {
          const stepTitle = stepTexts[i * 2] || null;
          const stepDesc = stepTexts[i * 2 + 1] || recipe.steps[i].description;
          translatedSteps.push({
            title: stepTitle,
            description: stepDesc,
          });
        }
        translationsByLocale[targetLang] = {
          title: transTitle || recipe.title,
          description: transDesc || recipe.description,
          preservation: transPres || null,
          tips: transTips || null,
          steps: translatedSteps,
        };
      }
    }

    // Invariant metrics
    const total_time = recipe.prep_time + recipe.cook_time;
    const translation_status = overallTranslationSuccess
      ? TranslationStatus.completed
      : TranslationStatus.failed;
    const localesWithTranslations = allLocales.filter(
      (locale) => translationsByLocale[locale],
    );

    // Structure relational payload
    const recipeTranslationsData = localesWithTranslations.map((locale) => ({
      locale,
      title: translationsByLocale[locale].title,
      description: translationsByLocale[locale].description,
      preservation: translationsByLocale[locale].preservation,
      tips: translationsByLocale[locale].tips,
      translation_source:
        locale === recipe.source_lang
          ? TranslationSource.author_original
          : TranslationSource.machine,
    }));
    const stepsData = recipe.steps.map((step, index) => ({
      step_number: step.step_number,
      duration: step.duration ?? null,
      translations: {
        create: localesWithTranslations.map((locale) => ({
          locale,
          title: translationsByLocale[locale].steps[index]?.title ?? null,
          description:
            translationsByLocale[locale].steps[index]?.description ??
            step.description,
        })),
      },
    }));
    const recipeIngredientsData = recipe.ingredients.map((ing) => ({
      ingredient_id: ing.ingredient_id,
      quantity: ing.quantity,
      unit: ing.unit,
      notes: ing.notes
        ? typeof ing.notes === 'string'
          ? { [recipe.source_lang]: ing.notes }
          : ing.notes
        : undefined,
    }));
    const recipeTagsData =
      recipe.tag_ids && recipe.tag_ids.length > 0
        ? {
            create: recipe.tag_ids.map((tagId) => ({
              tag_id: tagId,
            })),
          }
        : undefined;

    // Execute database transaction
    const createdRecipe = await this.prisma.$transaction(async (tx) => {
      return await tx.recipe.create({
        data: {
          user_id: userId,
          owner_type: OwnerType.user,
          privacy: recipe.privacy ?? RecipePrivacy.public,
          course: recipe.course,
          difficulty: recipe.difficulty,
          prep_time: recipe.prep_time,
          cook_time: recipe.cook_time,
          total_time,
          servings: recipe.servings,
          source_lang: recipe.source_lang,
          translation_status,
          translations: {
            create: recipeTranslationsData,
          },
          steps: {
            create: stepsData,
          },
          recipe_ingredients: {
            create: recipeIngredientsData,
          },
          recipe_tags: recipeTagsData,
        },
      });
    });

    return await this.getRecipeById(
      createdRecipe.id,
      recipe.source_lang,
      userId,
    );
  }

  // ---------------------------------------------------------------------------

  /* 
  PATCH /api/recipes/:id
  */
  async updateRecipe(
    userIdOrCaller: number | { id: number; role?: Role | string },
    recipeId: number,
    recipeUpdate: UpdateRecipeDto,
    retranslate?: boolean,
  ) {
    const userId =
      typeof userIdOrCaller === 'number' ? userIdOrCaller : userIdOrCaller.id;
    let userRole =
      typeof userIdOrCaller === 'object' && userIdOrCaller.role
        ? (userIdOrCaller.role as Role)
        : undefined;

    // Fetch recipe with translations, steps, and author role
    const recipe = await this.prisma.recipe.findUnique({
      where: {
        id: recipeId,
      },
      include: {
        user: { select: { id: true, role: true } },
        translations: true,
        steps: {
          include: { translations: true },
          orderBy: { step_number: 'asc' },
        },
      },
    });

    if (!recipe) {
      throw createHttpException(errors.recipes.notFound, 'Recipe not found');
    }

    if (!userRole && this.prisma.user?.findUnique) {
      const caller = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      userRole = caller?.role;
    }

    const isAuthor = recipe.user_id === userId;

    if (userRole === Role.admin) {
      // Administrator authorized to update or restore any recipe
    } else if (userRole === Role.moderator) {
      // Moderator cannot modify or restore recipes authored by administrators
      if (recipe.user?.role === Role.admin) {
        throw createHttpException(
          errors.common.forbidden,
          'Moderators cannot moderate or delete administrator content',
        );
      }
    } else {
      if (!isAuthor) {
        if (this.productionConfig.isProduction()) {
          throw createHttpException(errors.recipes.notFound, 'Recipe not found');
        } else {
          throw new NotFoundException('UserId is not the author of the recipe');
        }
      }

      // Authors cannot modify is_active (restoration restricted to staff)
      if (recipeUpdate.is_active !== undefined) {
        throw createHttpException(
          errors.common.forbidden,
          'Only platform staff can modify recipe activation status',
        );
      }
    }

    // Update locale-invariant data of the recipe
    const updateData: any = {};
    if (recipeUpdate.privacy !== undefined)
      updateData.privacy = recipeUpdate.privacy;
    if (recipeUpdate.is_active !== undefined)
      updateData.is_active = recipeUpdate.is_active;
    if (recipeUpdate.course !== undefined)
      updateData.course = recipeUpdate.course;
    if (recipeUpdate.difficulty !== undefined)
      updateData.difficulty = recipeUpdate.difficulty;
    if (recipeUpdate.servings !== undefined)
      updateData.servings = recipeUpdate.servings;
    if (recipeUpdate.prep_time !== undefined)
      updateData.prep_time = recipeUpdate.prep_time;
    if (recipeUpdate.cook_time !== undefined)
      updateData.cook_time = recipeUpdate.cook_time;

    // Recalculate total_time if prep_time or cook_time was modified
    if (
      recipeUpdate.prep_time !== undefined ||
      recipeUpdate.cook_time !== undefined
    ) {
      const pTime =
        recipeUpdate.prep_time !== undefined
          ? recipeUpdate.prep_time
          : recipe.prep_time;
      const cTime =
        recipeUpdate.cook_time !== undefined
          ? recipeUpdate.cook_time
          : recipe.cook_time;
      updateData.total_time = pTime + cTime;
    }

    // Determine target locale for translation update (defaults to recipe
    // source_lang)
    const targetLocale = recipeUpdate.locale ?? recipe.source_lang;

    // Validate retranslation invariant: retranslation is only allowed when modifying source_lang
    if (
      retranslate &&
      recipeUpdate.locale &&
      recipeUpdate.locale !== recipe.source_lang
    ) {
      throw new BadRequestException(
        `Automatic retranslation is only permitted when modifying the recipe in its source language ('${recipe.source_lang}')`,
      );
    }

    const transUpdate: any = {};
    if (recipeUpdate.title !== undefined)
      transUpdate.title = recipeUpdate.title;
    if (recipeUpdate.description !== undefined)
      transUpdate.description = recipeUpdate.description;
    if (recipeUpdate.preservation !== undefined)
      transUpdate.preservation = recipeUpdate.preservation;
    if (recipeUpdate.tips !== undefined) transUpdate.tips = recipeUpdate.tips;

    if (recipeUpdate.steps !== undefined) {
      const stepNumbers = recipeUpdate.steps.map((step) => step.step_number);
      const uniqueStepNumbers = new Set(stepNumbers);
      if (uniqueStepNumbers.size !== stepNumbers.length) {
        const duplicateStepNumber = stepNumbers.find(
          (stepNumber, index) => stepNumbers.indexOf(stepNumber) !== index,
        );
        throw new BadRequestException(
          `Duplicate step number: ${duplicateStepNumber}. Each step number must be unique.`,
        );
      }

      const sortedStepNumbers = [...stepNumbers].sort((a, b) => a - b);
      const missingStepIndex = sortedStepNumbers.findIndex(
        (stepNumber, index) => stepNumber !== index + 1,
      );
      if (missingStepIndex !== -1) {
        throw new BadRequestException(
          `Step numbers must be consecutive starting at 1. Missing step number: ${missingStepIndex + 1}.`,
        );
      }
    }

    if (recipeUpdate.ingredients !== undefined) {
      const ingredientIds = recipeUpdate.ingredients.map(
        (ingredient) => ingredient.ingredient_id,
      );
      const uniqueIngredientIds = new Set(ingredientIds);
      if (uniqueIngredientIds.size !== ingredientIds.length) {
        const duplicateIngredientId = ingredientIds.find(
          (ingredientId, index) =>
            ingredientIds.indexOf(ingredientId) !== index,
        );
        throw new BadRequestException(
          `Duplicate ingredient ID: ${duplicateIngredientId}. Each ingredient may only be added once.`,
        );
      }

      const existingIngredients = await this.prisma.ingredient.findMany({
        where: { id: { in: ingredientIds } },
        select: { id: true },
      });
      const existingIngredientIds = new Set(
        existingIngredients.map((ingredient) => ingredient.id),
      );
      for (const ingredientId of ingredientIds) {
        if (!existingIngredientIds.has(ingredientId)) {
          throw new BadRequestException(
            `Ingredient with ID ${ingredientId} does not exist in catalog`,
          );
        }
      }
    }

    if (recipeUpdate.tag_ids !== undefined) {
      const uniqueTagIds = new Set(recipeUpdate.tag_ids);
      if (uniqueTagIds.size !== recipeUpdate.tag_ids.length) {
        const duplicateTagId = recipeUpdate.tag_ids.find(
          (tagId, index) => recipeUpdate.tag_ids!.indexOf(tagId) !== index,
        );
        throw new BadRequestException(
          `Duplicate tag ID: ${duplicateTagId}. Each tag may only be added once.`,
        );
      }

      const existingTags = await this.prisma.tag.findMany({
        where: { id: { in: recipeUpdate.tag_ids } },
        select: { id: true },
      });
      const existingTagIds = new Set(existingTags.map((tag) => tag.id));
      for (const tagId of recipeUpdate.tag_ids) {
        if (!existingTagIds.has(tagId)) {
          throw new BadRequestException(
            `Tag with ID ${tagId} does not exist in catalog`,
          );
        }
      }
    }

    if (recipeUpdate.ingredients !== undefined) {
      updateData.recipe_ingredients = {
        deleteMany: {},
        create: recipeUpdate.ingredients.map((ingredient) => ({
          ingredient_id: ingredient.ingredient_id,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          notes: ingredient.notes
            ? typeof ingredient.notes === 'string'
              ? { [recipe.source_lang]: ingredient.notes }
              : ingredient.notes
            : undefined,
        })),
      };
    }

    if (recipeUpdate.tag_ids !== undefined) {
      updateData.recipe_tags = {
        deleteMany: {},
        create: recipeUpdate.tag_ids.map((tagId) => ({
          tag_id: tagId,
        })),
      };
    }

    if (recipeUpdate.steps !== undefined) {
      updateData.steps = {
        deleteMany: {},
        create: recipeUpdate.steps.map((step) => {
          const existingStep = recipe.steps?.find(
            (currentStep) => currentStep.step_number === step.step_number,
          );
          const translations = (existingStep?.translations ?? [])
            .filter((translation) => translation.locale !== targetLocale)
            .map((translation) => ({
              locale: translation.locale,
              title: translation.title,
              description: translation.description,
            }));
          translations.push({
            locale: targetLocale,
            title: step.title ?? null,
            description: step.description,
          });

          return {
            step_number: step.step_number,
            duration: step.duration ?? null,
            image_url:
              (step as any).image_url ?? existingStep?.image_url ?? null,
            translations: { create: translations },
          };
        }),
      };
    }

    const translatedDataByLocale: Record<
      string,
      {
        title: string;
        description: string;
        preservation?: string | null;
        tips?: string | null;
        steps: Array<{
          stepNumber: number;
          title: string | null;
          description: string;
        }>;
      }
    > = {};

    // Re-translate content across remaining locales if retranslate flag is
    // enabled
    if (retranslate) {
      // Resolve canonical source text combining existing values with incoming
      // updates
      const sourceTrans = recipe.translations?.find(
        (t) => t.locale === recipe.source_lang,
      );
      const sourceTitle =
        (targetLocale === recipe.source_lang
          ? recipeUpdate.title
          : undefined) ??
        sourceTrans?.title ??
        recipeUpdate.title ??
        '';
      const sourceDesc =
        (targetLocale === recipe.source_lang
          ? recipeUpdate.description
          : undefined) ??
        sourceTrans?.description ??
        recipeUpdate.description ??
        '';
      const sourcePres =
        (targetLocale === recipe.source_lang
          ? recipeUpdate.preservation
          : undefined) ??
        sourceTrans?.preservation ??
        recipeUpdate.preservation ??
        null;
      const sourceTips =
        (targetLocale === recipe.source_lang ? recipeUpdate.tips : undefined) ??
        sourceTrans?.tips ??
        recipeUpdate.tips ??
        null;

      // Prepare text payload for batch machine translation
      const textsToTranslate: string[] = [
        sourceTitle,
        sourceDesc,
        sourcePres ?? '',
        sourceTips ?? '',
      ];

      const stepsToTranslate = recipeUpdate.steps ?? recipe.steps ?? [];
      for (const step of stepsToTranslate) {
        const sourceStepTranslation =
          'translations' in step
            ? step.translations?.find(
                (translation) => translation.locale === recipe.source_lang,
              )
            : undefined;
        textsToTranslate.push(
          'title' in step
            ? (step.title ?? '')
            : (sourceStepTranslation?.title ?? ''),
        );
        textsToTranslate.push(
          'description' in step
            ? step.description
            : (sourceStepTranslation?.description ?? ''),
        );
      }

      // Execute machine translation across all other target locales
      const allLocales = ['it', 'en', 'fr'];
      const targetLocales = allLocales.filter((l) => l !== recipe.source_lang);
      let overallSuccess = true;

      for (const targetLang of targetLocales) {
        const res = await this.translationService.translateBatch(
          textsToTranslate,
          recipe.source_lang,
          targetLang,
        );
        if (!res.success) {
          overallSuccess = false;
          break;
        }
        const [transTitle, transDesc, transPres, transTips, ...stepTexts] =
          res.translations;
        const stepTranslations: Array<{
          stepNumber: number;
          title: string | null;
          description: string;
        }> = [];
        for (let i = 0; i < stepsToTranslate.length; i++) {
          const step = stepsToTranslate[i];
          const sTitle = stepTexts[i * 2] || null;
          const sDesc = stepTexts[i * 2 + 1] || '';
          stepTranslations.push({
            stepNumber: step.step_number,
            title: sTitle,
            description: sDesc,
          });
        }
        translatedDataByLocale[targetLang] = {
          title: transTitle || sourceTitle,
          description: transDesc || sourceDesc,
          preservation: transPres || null,
          tips: transTips || null,
          steps: stepTranslations,
        };
      }

      // Update translation status based on batch translation result
      updateData.translation_status = overallSuccess ? 'completed' : 'failed';

      // Update steps translations
      if (
        recipeUpdate.steps !== undefined &&
        updateData.translation_status === 'completed'
      ) {
        updateData.steps.create = recipeUpdate.steps.map((step) => {
          const existingStep = recipe.steps?.find(
            (currentStep) => currentStep.step_number === step.step_number,
          );
          const translations = [
            {
              locale: recipe.source_lang,
              title: step.title ?? null,
              description: step.description,
            },
          ];
          for (const [locale, translation] of Object.entries(
            translatedDataByLocale,
          )) {
            const existingTrans = recipe.translations?.find(
              (t) => t.locale === locale,
            );
            if (
              existingTrans &&
              (existingTrans.translation_source === TranslationSource.manual ||
                existingTrans.translation_source ===
                  TranslationSource.author_original)
            ) {
              const existingStepTrans = existingStep?.translations?.find(
                (tr) => tr.locale === locale,
              );
              if (existingStepTrans) {
                translations.push({
                  locale,
                  title: existingStepTrans.title,
                  description: existingStepTrans.description,
                });
                continue;
              }
            }
            const translatedStep = translation.steps.find(
              (candidate) => candidate.stepNumber === step.step_number,
            );
            if (translatedStep) {
              translations.push({
                locale,
                title: translatedStep.title,
                description: translatedStep.description,
              });
            }
          }
          return {
            step_number: step.step_number,
            duration: step.duration ?? null,
            image_url:
              (step as any).image_url ?? existingStep?.image_url ?? null,
            translations: { create: translations },
          };
        });
      }
    }

    // Execute atomic database updates inside transaction
    await this.prisma.$transaction(async (tx) => {
      // Upsert direct translation modifications for the targeted locale
      if (Object.keys(transUpdate).length > 0) {
        const isSourceLocale = targetLocale === recipe.source_lang;
        if (!isSourceLocale) {
          transUpdate.translation_source = TranslationSource.manual;
        }

        await tx.recipeTranslation.upsert({
          where: {
            recipe_id_locale: {
              recipe_id: recipeId,
              locale: targetLocale,
            },
          },
          create: {
            recipe_id: recipeId,
            locale: targetLocale,
            title: recipeUpdate.title ?? '',
            description: recipeUpdate.description ?? '',
            preservation: recipeUpdate.preservation ?? null,
            tips: recipeUpdate.tips ?? null,
            translation_source: isSourceLocale
              ? TranslationSource.author_original
              : TranslationSource.manual,
          },
          update: transUpdate,
        });
      }

      // Upsert re-translated content for remaining locales when retranslate
      // succeeded
      if (retranslate && updateData.translation_status === 'completed') {
        for (const [locale, trans] of Object.entries(translatedDataByLocale)) {
          const existingTrans = recipe.translations?.find(
            (t) => t.locale === locale,
          );
          if (
            existingTrans &&
            (existingTrans.translation_source === TranslationSource.manual ||
              existingTrans.translation_source ===
                TranslationSource.author_original)
          ) {
            continue;
          }

          await tx.recipeTranslation.upsert({
            where: {
              recipe_id_locale: {
                recipe_id: recipeId,
                locale,
              },
            },
            create: {
              recipe_id: recipeId,
              locale,
              title: trans.title,
              description: trans.description,
              preservation: trans.preservation,
              tips: trans.tips,
              translation_source: TranslationSource.machine,
            },
            update: {
              title: trans.title,
              description: trans.description,
              preservation: trans.preservation,
              tips: trans.tips,
              translation_source: TranslationSource.machine,
            },
          });

          if (recipeUpdate.steps === undefined) {
            for (const stepTrans of trans.steps) {
              const step = recipe.steps?.find(
                (recipeStep) => recipeStep.step_number === stepTrans.stepNumber,
              );
              if (!step) continue;
              await tx.recipeStepTranslation.upsert({
                where: {
                  step_id_locale: {
                    step_id: step.id,
                    locale,
                  },
                },
                create: {
                  step_id: step.id,
                  locale,
                  title: stepTrans.title,
                  description: stepTrans.description,
                },
                update: {
                  title: stepTrans.title,
                  description: stepTrans.description,
                },
              });
            }
          }
        }
      }

      // Update invariant recipe fields and translation status
      await tx.recipe.update({
        where: {
          id: recipeId,
        },
        data: updateData,
      });
    });

    // Safely cleanup physical files for any steps that were removed from the
    // recipe
    if (recipeUpdate.steps !== undefined) {
      const newStepNumbers = new Set(
        recipeUpdate.steps.map((s) => s.step_number),
      );
      for (const oldStep of recipe.steps ?? []) {
        if (!newStepNumbers.has(oldStep.step_number) && oldStep.image_url) {
          await this.safeUnlink(oldStep.image_url);
        }
      }
    }

    return await this.getRecipeById(recipeId, targetLocale, userId);
  }

  // ---------------------------------------------------------------------------

  // Helper to safely delete physical file from disk
  private async safeUnlink(fileUrl?: string | null): Promise<void> {
    if (!fileUrl) return;
    const absolutePath = resolveStoredUploadPath(fileUrl);
    if (!absolutePath) return;
    try {
      await fs.promises.unlink(absolutePath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') {
        // Safe fallback ignoring non-existent files
      }
    }
  }

  // ---------------------------------------------------------------------------

  /**
   * Suspend/deactivate a recipe following role hierarchy rules.
   * - admin: can suspend any recipe
   * - moderator: can suspend user/moderator recipes (403 on admin recipes)
   * - user: can suspend own recipes
   */
  async deactivateRecipe(
    recipeId: number,
    caller: number | { id: number; role?: Role | string },
  ) {
    const callerId = typeof caller === 'number' ? caller : caller.id;
    let callerRole =
      typeof caller === 'object' && caller.role
        ? (caller.role as Role)
        : undefined;

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        user: { select: { id: true, role: true } },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    if (!callerRole && this.prisma.user?.findUnique) {
      const user = await this.prisma.user.findUnique({
        where: { id: callerId },
        select: { role: true },
      });
      callerRole = user?.role;
    }

    if (callerRole === Role.admin) {
      // Admin authorized
    } else if (callerRole === Role.moderator) {
      if (recipe.user?.role === Role.admin) {
        throw createHttpException(
          errors.common.forbidden,
          'Moderators cannot moderate or delete administrator content',
        );
      }
    } else {
      if (recipe.user_id !== callerId) {
        if (this.productionConfig.isProduction()) {
          throw new NotFoundException('Recipe not found');
        } else {
          throw new NotFoundException('UserId not the author of the recipe');
        }
      }
    }

    return await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { is_active: false },
    });
  }

  /* 
  DELETE /api/recipes/:id
  */
  async deleteRecipe(
    recipeId: number,
    userOrId: number | { id: number; role?: Role | string },
    query?: DeleteRecipeQueryDto,
  ) {
    const isHard = Boolean(query?.hard);

    // If soft suspension (default): delegate directly to deactivateRecipe
    if (!isHard) {
      return await this.deactivateRecipe(recipeId, userOrId);
    }

    // Hard deletion path: restricted strictly to platform administrators
    const userId = typeof userOrId === 'number' ? userOrId : userOrId.id;
    let userRole =
      typeof userOrId === 'object' && userOrId.role
        ? (userOrId.role as Role)
        : undefined;

    if (!userRole && this.prisma.user?.findUnique) {
      const caller = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });
      userRole = caller?.role;
    }

    if (userRole !== Role.admin) {
      throw createHttpException(errors.common.adminOnly);
    }

    // Verify that the recipe exists and fetch associated media
    const recipe = await this.prisma.recipe.findUnique({
      where: {
        id: recipeId,
      },
      include: {
        user: {
          select: { id: true, role: true },
        },
        steps: {
          select: { image_url: true },
        },
        recipe_media: {
          select: { url: true },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    // Collect all media URLs to clean up from disk
    const mediaUrls: string[] = [];
    if (recipe.cover_image_url) mediaUrls.push(recipe.cover_image_url);
    if (recipe.video_url) mediaUrls.push(recipe.video_url);
    for (const step of recipe.steps ?? []) {
      if (step.image_url) mediaUrls.push(step.image_url);
    }
    for (const media of recipe.recipe_media ?? []) {
      if (media.url) mediaUrls.push(media.url);
    }

    // Transactionally delete comments, notifications, and recipe
    await this.prisma.$transaction(async (tx) => {
      await tx.comment.deleteMany({
        where: { recipe_id: recipeId },
      });

      await tx.notification.deleteMany({
        where: {
          subject: NotificationSubject.recipe,
          target_id: recipeId,
        },
      });

      await tx.recipe.delete({
        where: { id: recipeId },
      });
    });

    // Safely remove physical files from filesystem
    for (const url of mediaUrls) {
      await this.safeUnlink(url);
    }

    return { message: 'Recipe permanently deleted successfully' };
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/translate
  */
  async retryTranslation(recipeId: number, userId: number) {
    // Fetch the recipe from database, joining it with its translations and
    // ordered steps
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        translations: true,
        steps: {
          include: { translations: true },
          orderBy: { step_number: 'asc' },
        },
      },
    });

    // Guard: Verify existence and ownership (only author can update recipe)
    // In production, both return 404 (security through obscurity)
    if (
      !recipe ||
      (recipe.user_id !== userId && this.productionConfig.isProduction())
    )
      throw new NotFoundException('Recipe not found');
    else if (recipe.user_id !== userId)
      // Development only
      throw new NotFoundException('UserId not the author of the recipe');

    // Guard: Only allow retry when previous translation status failed
    if (recipe.translation_status !== 'failed') {
      throw new BadRequestException(
        'Translation retry is only available for failed translations',
      );
    }

    // Find original language canonical translation
    const sourceTrans = recipe.translations.find(
      (t) => t.locale === recipe.source_lang,
    );
    if (!sourceTrans) {
      throw new NotFoundException('Source translation not found');
    }

    // Prepare text payload for batch translation
    const allLocales = ['it', 'en', 'fr'];
    const targetLocales = allLocales.filter((l) => l !== recipe.source_lang);
    const textsToTranslate: string[] = [
      sourceTrans.title,
      sourceTrans.description,
      sourceTrans.preservation ?? '',
      sourceTrans.tips ?? '',
    ];
    for (const step of recipe.steps) {
      const stepSourceTrans = step.translations.find(
        (t) => t.locale === recipe.source_lang,
      );
      textsToTranslate.push(stepSourceTrans?.title ?? '');
      textsToTranslate.push(stepSourceTrans?.description ?? '');
    }

    // Translate across target locales
    let overallSuccess = true;
    const translatedDataByLocale: Record<
      string,
      {
        title: string;
        description: string;
        preservation?: string | null;
        tips?: string | null;
        steps: Array<{
          stepId: number;
          title: string | null;
          description: string;
        }>;
      }
    > = {};

    for (const targetLang of targetLocales) {
      const res = await this.translationService.translateBatch(
        textsToTranslate,
        recipe.source_lang,
        targetLang,
      );
      if (!res.success) {
        overallSuccess = false;
        break;
      }
      const [transTitle, transDesc, transPres, transTips, ...stepTexts] =
        res.translations;
      const stepTranslations: Array<{
        stepId: number;
        title: string | null;
        description: string;
      }> = [];
      for (let i = 0; i < recipe.steps.length; i++) {
        const step = recipe.steps[i];
        const sTitle = stepTexts[i * 2] || null;
        const sDesc = stepTexts[i * 2 + 1] || '';
        stepTranslations.push({
          stepId: step.id,
          title: sTitle,
          description: sDesc,
        });
      }
      translatedDataByLocale[targetLang] = {
        title: transTitle || sourceTrans.title,
        description: transDesc || sourceTrans.description,
        preservation: transPres || null,
        tips: transTips || null,
        steps: stepTranslations,
      };
    }

    // If translation service failed, maintain failed status in database
    if (!overallSuccess) {
      return await this.prisma.recipe.update({
        where: { id: recipe.id },
        data: { translation_status: 'failed' },
      });
    }

    // Execute database transaction to persist translated records and set
    // status to completed
    return await this.prisma.$transaction(async (tx) => {
      // Upsert translations for each target locale
      for (const [locale, trans] of Object.entries(translatedDataByLocale)) {
        const existingTrans = recipe.translations.find(
          (t) => t.locale === locale,
        );
        if (
          existingTrans &&
          (existingTrans.translation_source === TranslationSource.manual ||
            existingTrans.translation_source ===
              TranslationSource.author_original)
        ) {
          continue;
        }

        await tx.recipeTranslation.upsert({
          where: {
            recipe_id_locale: {
              recipe_id: recipe.id,
              locale,
            },
          },
          create: {
            recipe_id: recipe.id,
            locale,
            title: trans.title,
            description: trans.description,
            preservation: trans.preservation,
            tips: trans.tips,
            translation_source: TranslationSource.machine,
          },
          update: {
            title: trans.title,
            description: trans.description,
            preservation: trans.preservation,
            tips: trans.tips,
            translation_source: TranslationSource.machine,
          },
        });

        // Upsert step translations for each step in this locale
        for (const stepTrans of trans.steps) {
          await tx.recipeStepTranslation.upsert({
            where: {
              step_id_locale: {
                step_id: stepTrans.stepId,
                locale,
              },
            },
            create: {
              step_id: stepTrans.stepId,
              locale,
              title: stepTrans.title,
              description: stepTrans.description,
            },
            update: {
              title: stepTrans.title,
              description: stepTrans.description,
            },
          });
        }
      }

      // Update recipe translation status to completed
      return await tx.recipe.update({
        where: { id: recipe.id },
        data: { translation_status: 'completed' },
      });
    });
  }

  // ---------------------------------------------------------------------------

  private async assertRecipeAuthor(recipeId: number, userId: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    // In production, both missing recipe and non-author return 404 (security through obscurity)
    if (
      !recipe ||
      (recipe.user_id !== userId && this.productionConfig.isProduction())
    ) {
      throw new NotFoundException('Recipe not found');
    }
    if (recipe.user_id !== userId) {
      throw new NotFoundException('UserId not the author of the recipe');
    }

    return recipe;
  }

  private async cleanupUploadedFiles(
    files: Array<Express.Multer.File | undefined>,
  ): Promise<void> {
    await Promise.all(
      files
        .filter((f): f is Express.Multer.File => Boolean(f?.path))
        .map((f) => fs.promises.unlink(f.path).catch(() => {})),
    );
  }

  private async cleanupProcessedOutputs(
    outputs: ProcessedMediaResult[],
  ): Promise<void> {
    await Promise.all(
      outputs.map((item) =>
        fs.promises
          .unlink(join(RECIPE_UPLOADS_DIR, item.filename))
          .catch(() => {}),
      ),
    );
  }

  /*
  POST /api/recipes/:id/cover
  */
  async uploadCoverImage(
    recipeId: number,
    userId: number,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    let processedOutput: ProcessedMediaResult | null = null;
    try {
      const recipe = await this.assertRecipeAuthor(recipeId, userId);

      processedOutput = await this.imageProcessingService.processRecipeImageFile(
        file,
        recipeId,
      );
      const fileUrl = processedOutput.relativePath;

      await this.prisma.recipe.update({
        where: { id: recipeId },
        data: { cover_image_url: fileUrl },
      });

      if (recipe.cover_image_url) {
        await this.safeUnlink(recipe.cover_image_url);
      }

      return { cover_image_url: fileUrl };
    } catch (err) {
      if (processedOutput) {
        await this.cleanupProcessedOutputs([processedOutput]);
      }
      await this.cleanupUploadedFiles([file]);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/steps/:stepNumber/image
  */
  async uploadStepImage(
    recipeId: number,
    stepNumber: number,
    userId: number,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    let processedOutput: ProcessedMediaResult | null = null;
    try {
      await this.assertRecipeAuthor(recipeId, userId);

      // Guard: Verify recipe step exists
      const step = await this.prisma.recipeStep.findFirst({
        where: {
          recipe_id: recipeId,
          step_number: stepNumber,
        },
      });
      if (!step) {
        throw new NotFoundException('Recipe step not found');
      }

      processedOutput = await this.imageProcessingService.processRecipeImageFile(
        file,
        recipeId,
      );
      const fileUrl = processedOutput.relativePath;

      await this.prisma.recipeStep.update({
        where: { id: step.id },
        data: { image_url: fileUrl },
      });

      if (step.image_url) {
        await this.safeUnlink(step.image_url);
      }

      return { step_number: stepNumber, image_url: fileUrl };
    } catch (err) {
      if (processedOutput) {
        await this.cleanupProcessedOutputs([processedOutput]);
      }
      await this.cleanupUploadedFiles([file]);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/gallery
  */
  async uploadGalleryMedia(
    recipeId: number,
    userId: number,
    files: Express.Multer.File[],
  ) {
    const processedFiles: ProcessedMediaResult[] = [];
    try {
      await this.assertRecipeAuthor(recipeId, userId);

      // Guard: Validate that at least one file is provided
      if (!files || files.length === 0) {
        throw new BadRequestException('At least one file must be provided');
      }

      // Guard: Fetch existing gallery media and ensure limit of 3 is respected
      const existingMedia = await this.prisma.recipeMedia.findMany({
        where: {
          recipe_id: recipeId,
          media_type: MediaType.image,
        },
        orderBy: { order: 'asc' },
      });

      if (existingMedia.length + files.length > 3) {
        throw new BadRequestException(
          `Cannot upload more than 3 gallery images per recipe. Already has ${existingMedia.length}.`,
        );
      }

      const settled = await Promise.allSettled(
        files.map((file) =>
          this.imageProcessingService.processRecipeImageFile(file, recipeId),
        ),
      );

      let firstRejection: unknown = null;
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          processedFiles.push(result.value);
        } else if (firstRejection === null) {
          firstRejection = result.reason;
        }
      }
      if (firstRejection !== null) {
        throw firstRejection;
      }

      // Persist all gallery media items atomically so partial DB errors roll back cleanly
      const startingOrder = existingMedia.length;
      const createdMedia = await this.prisma.$transaction(async (tx) => {
        const items: any[] = [];
        for (let i = 0; i < processedFiles.length; i++) {
          const { relativePath: fileUrl } = processedFiles[i];
          const media = await tx.recipeMedia.create({
            data: {
              recipe_id: recipeId,
              url: fileUrl,
              media_type: MediaType.image,
              order: startingOrder + i,
            },
          });
          items.push(media);
        }
        return items;
      });

      return createdMedia;
    } catch (err) {
      await this.cleanupProcessedOutputs(processedFiles);
      await this.cleanupUploadedFiles(files ?? []);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------

  /*
  POST /api/recipes/:id/video
  */
  async uploadVideo(
    recipeId: number,
    userId: number,
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    let processedOutput: ProcessedMediaResult | null = null;
    try {
      const recipe = await this.assertRecipeAuthor(recipeId, userId);

      processedOutput = await this.videoProcessingService.processVideoFile(
        file,
        recipeId,
      );
      const fileUrl = processedOutput.relativePath;

      await this.prisma.recipe.update({
        where: { id: recipeId },
        data: { video_url: fileUrl },
      });

      if (recipe.video_url) {
        await this.safeUnlink(recipe.video_url);
      }

      return { video_url: fileUrl };
    } catch (err) {
      if (processedOutput) {
        await this.cleanupProcessedOutputs([processedOutput]);
      }
      await this.cleanupUploadedFiles([file]);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------

  /*
  DELETE /api/recipes/:id/cover
  */
  async deleteCoverImage(recipeId: number, userId: number) {
    // Fetch recipe from database
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    // Guard: Verify existence and ownership (only author can delete images)
    // In production, both return 404 (security through obscurity)
    if (
      !recipe ||
      (recipe.user_id !== userId && this.productionConfig.isProduction())
    )
      throw new NotFoundException('Recipe not found');
    else if (recipe.user_id !== userId)
      // Development only
      throw new NotFoundException('UserId not the author of the recipe');

    // Safely remove cover image file from disk
    if (recipe.cover_image_url) {
      await this.safeUnlink(recipe.cover_image_url);
    }

    // Nullify cover_image_url on recipe
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { cover_image_url: null },
    });

    return { message: 'Cover image deleted successfully' };
  }

  // ---------------------------------------------------------------------------

  /*
  DELETE /api/recipes/:id/video
  */
  async deleteVideo(recipeId: number, userId: number) {
    // Fetch recipe from database
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    // Guard: Verify existence and ownership (only author can delete the video)
    // In production, both return 404 (security through obscurity)
    if (
      !recipe ||
      (recipe.user_id !== userId && this.productionConfig.isProduction())
    )
      throw new NotFoundException('Recipe not found');
    else if (recipe.user_id !== userId)
      // Development only
      throw new NotFoundException('UserId not the author of the recipe');

    // Safely remove video file from disk
    if (recipe.video_url) {
      await this.safeUnlink(recipe.video_url);
    }

    // Nullify video_url on recipe
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { video_url: null },
    });

    return { message: 'Recipe video deleted successfully' };
  }

  // ---------------------------------------------------------------------------

  /*
  DELETE /api/recipes/:id/steps/:stepNumber/image
  */
  async deleteStepImage(recipeId: number, stepNumber: number, userId: number) {
    // Fetch recipe from database
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    // Guard: Verify existence and ownership (only author can delete images)
    // In production, both return 404 (security through obscurity)
    if (
      !recipe ||
      (recipe.user_id !== userId && this.productionConfig.isProduction())
    )
      throw new NotFoundException('Recipe not found');
    else if (recipe.user_id !== userId)
      // Development only
      throw new NotFoundException('UserId not the author of the recipe');

    // Locate requested step
    const step = await this.prisma.recipeStep.findFirst({
      where: {
        recipe_id: recipeId,
        step_number: stepNumber,
      },
    });
    if (!step) {
      throw new NotFoundException('Step not found');
    }

    // Safely remove step image file from disk
    if (step.image_url) {
      await this.safeUnlink(step.image_url);
    }

    // Nullify image_url on step
    await this.prisma.recipeStep.update({
      where: { id: step.id },
      data: { image_url: null },
    });

    return { message: 'Step image deleted successfully' };
  }

  // ---------------------------------------------------------------------------

  /*
  DELETE /api/recipes/:id/gallery/:mediaId
  */
  async deleteGalleryMedia(recipeId: number, mediaId: number, userId: number) {
    // Fetch recipe from database
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    // Guard: Verify existence and ownership (only author can delete images)
    // In production, both return 404 (security through obscurity)
    if (
      !recipe ||
      (recipe.user_id !== userId && this.productionConfig.isProduction())
    )
      throw new NotFoundException('Recipe not found');
    else if (recipe.user_id !== userId)
      // Development only
      throw new NotFoundException('UserId not the author of the recipe');

    // Locate requested gallery media
    const media = await this.prisma.recipeMedia.findFirst({
      where: {
        id: mediaId,
        recipe_id: recipeId,
      },
    });
    if (!media) {
      throw new NotFoundException('Gallery media not found');
    }

    // Safely remove gallery image file from disk
    if (media.url) {
      await this.safeUnlink(media.url);
    }

    // Delete gallery media record
    await this.prisma.recipeMedia.delete({
      where: { id: media.id },
    });

    return { message: 'Gallery media deleted successfully' };
  }

  // ---------------------------------------------------------------------------

  async likeRecipe(
    recipeId: number,
    userId: number,
  ): Promise<{ message: string; liked: boolean; likes_count: number }> {
    // Verify that the recipe exists
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, user_id: true },
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    if (recipe.user_id && this.prisma.userBlock) {
      const isBlocked = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blocker_id: userId, blocked_id: recipe.user_id },
            { blocker_id: recipe.user_id, blocked_id: userId },
          ],
        },
      });
      if (isBlocked) {
        throw new NotFoundException('Recipe not found');
      }
    }

    let newlyCreated = false;
    try {
      await this.prisma.like.create({
        data: {
          user_id: userId,
          recipe_id: recipeId,
        },
      });
      newlyCreated = true;
    } catch (error: any) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002') ||
        error?.code === 'P2002'
      ) {
        newlyCreated = false;
      } else {
        throw error;
      }
    }

    // Dispatch social notification to recipe author (unless self-like)
    if (newlyCreated && recipe.user_id && recipe.user_id !== userId) {
      await this.notificationEmit.notification(
        { id_user: userId, id_target: recipeId },
        {
          subject: NotificationSubject.recipe,
          action: NotificationAction.like,
        },
      );
    }

    const likesCount = await this.prisma.like.count({
      where: { recipe_id: recipeId },
    });

    return {
      message: 'Recipe liked successfully',
      liked: true,
      likes_count: likesCount,
    };
  }

  // ---------------------------------------------------------------------------

  async unlikeRecipe(
    recipeId: number,
    userId: number,
  ): Promise<{ message: string; liked: boolean; likes_count: number }> {
    // Verify that the recipe exists
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, user_id: true },
    });
    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    if (recipe.user_id && this.prisma.userBlock) {
      const isBlocked = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blocker_id: userId, blocked_id: recipe.user_id },
            { blocker_id: recipe.user_id, blocked_id: userId },
          ],
        },
      });
      if (isBlocked) {
        throw new NotFoundException('Recipe not found');
      }
    }

    try {
      await this.prisma.like.delete({
        where: {
          user_id_recipe_id: {
            user_id: userId,
            recipe_id: recipeId,
          },
        },
      });
    } catch (error: any) {
      if (!(
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025') ||
        error?.code === 'P2025'
      )) {
        throw error;
      }
    }

    // Prune unread like notification targeting the recipe author
    if (recipe.user_id && recipe.user_id !== userId) {
      await this.prisma.notification.deleteMany({
        where: {
          user_id: recipe.user_id,
          actor_id: userId,
          subject: NotificationSubject.recipe,
          action: NotificationAction.like,
          target_id: recipeId,
          is_read: false,
        },
      });
    }

    const likesCount = await this.prisma.like.count({
      where: { recipe_id: recipeId },
    });

    return {
      message: 'Recipe unliked successfully',
      liked: false,
      likes_count: likesCount,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Post a new comment or reply on a recipe with 2-level hierarchy normalization.
   */
  async createComment(recipeId: number, userId: number, dto: CreateCommentDto) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, user_id: true },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    if (recipe.user_id && this.prisma.userBlock) {
      const isBlocked = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blocker_id: userId, blocked_id: recipe.user_id },
            { blocker_id: recipe.user_id, blocked_id: userId },
          ],
        },
      });
      if (isBlocked) {
        throw new NotFoundException('Recipe not found');
      }
    }

    let parentId: number | null = null;
    let parentComment: {
      id: number;
      user_id: number | null;
      parent_id: number | null;
      recipe_id: number;
    } | null = null;

    if (dto.parent_id !== undefined && dto.parent_id !== null) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parent_id },
        select: { id: true, user_id: true, parent_id: true, recipe_id: true },
      });

      if (!parent) {
        throw new BadRequestException('Parent comment does not exist');
      } else if (parent.recipe_id !== recipeId) {
        throw new BadRequestException(
          'Parent comment does not belong to this recipe',
        );
      }

      // Enforce 2-level hierarchy: if parent is already a reply, normalize to
      // its root parent_id
      parentComment = parent;
      parentId = parent.parent_id !== null ? parent.parent_id : parent.id;
    }

    const comment = await this.prisma.comment.create({
      data: {
        recipe_id: recipeId,
        user_id: userId,
        content: dto.content,
        parent_id: parentId,
        is_active: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });

    // Notification dispatch
    if (parentComment) {
      // Reply: strictly notify the parent comment author (unless self-reply)
      if (parentComment.user_id && parentComment.user_id !== userId) {
        await this.notificationEmit.notification(
          { id_user: userId, id_target: parentComment.id },
          {
            subject: NotificationSubject.comment,
            action: NotificationAction.comment,
          },
        );
      }
    } else {
      // Top-level comment: notify recipe author (unless self-comment)
      if (recipe.user_id && recipe.user_id !== userId) {
        await this.notificationEmit.notification(
          { id_user: userId, id_target: recipeId },
          {
            subject: NotificationSubject.recipe,
            action: NotificationAction.comment,
          },
        );
      }
    }

    return comment;
  }

  // ---------------------------------------------------------------------------

  /**
   * Retrieve threaded comments for a recipe with pagination, windowed replies,
   * activity-aware sorting, and role-based deactivation masking.
   */
  async getComments(
    recipeId: number,
    query?: RecipeCommentQueryDto,
    currentUser?: { id?: number; role?: string },
  ): Promise<PaginatedRecipeCommentsResponseDto> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, Math.min(100, query?.limit || 20));
    const skip = (page - 1) * limit;
    const repliesLimit = Math.max(1, Math.min(20, query?.replies_limit || 5));
    const sortBy = query?.sort_by ?? RecipeCommentSortBy.latest_activity;
    const sortOrder = query?.sort_order ?? SortOrder.desc;

    const rootComments = await this.prisma.comment.findMany({
      where: {
        recipe_id: recipeId,
        parent_id: null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatar_url: true,
              },
            },
          },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    const isStaff =
      currentUser?.role === Role.admin || currentUser?.role === Role.moderator;

    const visibleThreads: {
      item: ThreadedRecipeCommentResponseDto;
      rootTime: number;
      latestActivity: number;
    }[] = [];

    for (const root of rootComments) {
      const rawReplies = root.replies || [];
      const hasActiveReplies = rawReplies.some((r) => r.is_active);

      // Inactive root comments with zero active replies are excluded from total and result items
      if (!root.is_active && !hasActiveReplies) {
        continue;
      }

      let processedReplies: RecipeCommentResponseDto[];
      if (isStaff) {
        // Staff callers retain authentic inspection context for all replies
        processedReplies = rawReplies.map((r) => ({
          id: r.id,
          recipe_id: r.recipe_id,
          user_id: r.user_id,
          parent_id: r.parent_id,
          content: r.content,
          is_active: r.is_active,
          is_edited: r.is_edited ?? false,
          created_at: r.created_at,
          updated_at: r.updated_at ?? null,
          user: r.user,
        }));
      } else {
        // Public/guest callers: prune trailing deactivated replies
        const lastActiveIndex = rawReplies.findLastIndex((r) => r.is_active);
        const keptReplies =
          lastActiveIndex === -1
            ? []
            : rawReplies.slice(0, lastActiveIndex + 1);

        processedReplies = keptReplies.map((r) =>
          r.is_active
            ? {
                id: r.id,
                recipe_id: r.recipe_id,
                user_id: r.user_id,
                parent_id: r.parent_id,
                content: r.content,
                is_active: r.is_active,
                is_edited: r.is_edited ?? false,
                created_at: r.created_at,
                updated_at: r.updated_at ?? null,
                user: r.user,
              }
            : {
                id: r.id,
                recipe_id: r.recipe_id,
                user_id: null,
                parent_id: r.parent_id,
                content: null,
                is_active: false,
                is_edited: false,
                created_at: r.created_at,
                updated_at: null,
                user: null,
              },
        );
      }

      const repliesCount = processedReplies.length;
      const windowedReplies = processedReplies.slice(0, repliesLimit);
      const hasMoreReplies = repliesCount > windowedReplies.length;

      const rootTime = new Date(root.created_at).getTime();
      const replyTimes = processedReplies.map((r) =>
        new Date(r.created_at).getTime(),
      );
      const latestActivity =
        replyTimes.length > 0 ? Math.max(rootTime, ...replyTimes) : rootTime;

      let rootItem: ThreadedRecipeCommentResponseDto;
      if (isStaff || root.is_active) {
        rootItem = {
          id: root.id,
          recipe_id: root.recipe_id,
          user_id: root.user_id,
          parent_id: root.parent_id,
          content: root.content,
          is_active: root.is_active,
          is_edited: root.is_edited ?? false,
          created_at: root.created_at,
          updated_at: root.updated_at ?? null,
          user: root.user,
          replies: windowedReplies,
          replies_count: repliesCount,
          has_more_replies: hasMoreReplies,
        };
      } else {
        rootItem = {
          id: root.id,
          recipe_id: root.recipe_id,
          user_id: null,
          parent_id: root.parent_id,
          content: null,
          is_active: false,
          is_edited: false,
          created_at: root.created_at,
          updated_at: null,
          user: null,
          replies: windowedReplies,
          replies_count: repliesCount,
          has_more_replies: hasMoreReplies,
        };
      }

      visibleThreads.push({
        item: rootItem,
        rootTime,
        latestActivity,
      });
    }

    if (sortBy === RecipeCommentSortBy.created_at) {
      visibleThreads.sort((a, b) => {
        if (a.rootTime !== b.rootTime) {
          return sortOrder === SortOrder.asc
            ? a.rootTime - b.rootTime
            : b.rootTime - a.rootTime;
        }
        return sortOrder === SortOrder.asc
          ? a.item.id - b.item.id
          : b.item.id - a.item.id;
      });
    } else {
      // Default: latest_activity
      visibleThreads.sort((a, b) => {
        if (a.latestActivity !== b.latestActivity) {
          return sortOrder === SortOrder.asc
            ? a.latestActivity - b.latestActivity
            : b.latestActivity - a.latestActivity;
        }
        return sortOrder === SortOrder.asc
          ? a.item.id - b.item.id
          : b.item.id - a.item.id;
      });
    }

    const total = visibleThreads.length;
    const total_pages = total === 0 ? 0 : Math.ceil(total / limit);
    const pagedItems = visibleThreads
      .slice(skip, skip + limit)
      .map((entry) => entry.item);

    return {
      items: pagedItems,
      total,
      page,
      limit,
      total_pages,
      has_next_page: total > 0 && page < total_pages,
      has_prev_page: page > 1,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Retrieve paginated replies for a specific parent comment.
   * Public callers receive masked deactivated replies (content and user set to null).
   * Staff callers (admin and moderator) retain authentic inspection context.
   */
  async getCommentReplies(
    recipeId: number,
    commentId: number,
    query?: PaginationQueryDto,
    currentUser?: { id?: number; role?: string },
  ): Promise<PaginatedRecipeCommentRepliesResponseDto> {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const parentComment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!parentComment || parentComment.recipe_id !== recipeId) {
      throw new NotFoundException('Comment not found');
    }

    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, Math.min(100, query?.limit || 20));
    const skip = (page - 1) * limit;

    const [rawReplies, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: {
          recipe_id: recipeId,
          parent_id: commentId,
        },
        skip,
        take: limit,
        orderBy: { created_at: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              avatar_url: true,
            },
          },
        },
      }),
      this.prisma.comment.count({
        where: {
          recipe_id: recipeId,
          parent_id: commentId,
        },
      }),
    ]);

    const isStaff =
      currentUser?.role === Role.admin || currentUser?.role === Role.moderator;

    const items = rawReplies.map((r) => {
      if (isStaff || r.is_active) {
        return {
          id: r.id,
          recipe_id: r.recipe_id,
          user_id: r.user_id,
          parent_id: r.parent_id,
          content: r.content,
          is_active: r.is_active,
          is_edited: r.is_edited ?? false,
          created_at: r.created_at,
          updated_at: r.updated_at ?? null,
          user: r.user,
        };
      }

      return {
        id: r.id,
        recipe_id: r.recipe_id,
        user_id: null,
        parent_id: r.parent_id,
        content: null,
        is_active: false,
        is_edited: false,
        created_at: r.created_at,
        updated_at: null,
        user: null,
      };
    });

    const total_pages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      total_pages,
      has_next_page: total > 0 && page < total_pages,
      has_prev_page: page > 1,
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Delete or deactivate a recipe comment.
   * By default performs soft deletion (is_active = false) following role hierarchy:
   * - admin: can deactivate any comment on any recipe.
   * - moderator: can deactivate comments authored by users and moderators (403 on admin comments).
   * - user: can deactivate own comments or comments on authored recipes.
   *
   * With hard = true (admin only):
   * - requires prune_replies = true if comment has child replies (409 Conflict otherwise).
   * - permanently purges comment (and child replies if prune_replies = true).
   */
  async deleteComment(
    recipeId: number,
    commentId: number,
    userOrId: number | { id: number; role?: string },
    query?: DeleteCommentQueryDto,
  ): Promise<{ message: string }> {
    const userId = typeof userOrId === 'number' ? userOrId : userOrId.id;
    let userRole =
      typeof userOrId === 'object' && userOrId.role
        ? (userOrId.role as Role)
        : undefined;

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, user_id: true },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.recipe_id !== recipeId) {
      throw new NotFoundException('Comment not found');
    }

    // Hard deletion path (Admin only)
    if (query?.hard) {
      if (!userRole && this.prisma.user?.findUnique) {
        const caller = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        });
        userRole = caller?.role;
      }

      if (userRole !== Role.admin) {
        throw createHttpException(errors.common.adminOnly);
      }

      const childCount = await this.prisma.comment.count({
        where: { parent_id: commentId },
      });

      if (childCount > 0 && !query.prune_replies) {
        throw createHttpException(errors.comment.hasReplies);
      }

      if (childCount > 0 && query.prune_replies) {
        const childReplies = await this.prisma.comment.findMany({
          where: { parent_id: commentId },
          select: { id: true },
        });
        const childIds = childReplies.map((c) => c.id);

        await this.prisma.notification.deleteMany({
          where: {
            subject: NotificationSubject.comment,
            target_id: { in: [commentId, ...childIds] },
          },
        });

        await this.prisma.comment.deleteMany({
          where: { parent_id: commentId },
        });
        await this.prisma.comment.delete({
          where: { id: commentId },
        });

        return { message: 'Comment permanently deleted with replies' };
      }

      await this.prisma.notification.deleteMany({
        where: {
          subject: NotificationSubject.comment,
          target_id: commentId,
        },
      });
      await this.prisma.comment.delete({
        where: { id: commentId },
      });

      return { message: 'Comment permanently deleted successfully' };
    }

    // Soft deletion path (Default)
    // Role hierarchy authorization check
    if (userRole === Role.admin) {
      // Admin is authorized to deactivate any comment
    } else if (userRole === Role.moderator) {
      // Moderator cannot deactivate comments authored by administrators
      if (comment.user_id && this.prisma.user?.findUnique) {
        const author = await this.prisma.user.findUnique({
          where: { id: comment.user_id },
          select: { role: true },
        });
        if (author?.role === Role.admin) {
          throw createHttpException(errors.common.forbidden);
        }
      }
    } else {
      // Check if user is comment author or recipe author
      if (comment.user_id !== userId && recipe.user_id !== userId) {
        if (!userRole && this.prisma.user?.findUnique) {
          const caller = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { role: true },
          });
          userRole = caller?.role;

          if (userRole === Role.admin) {
            // Admin permitted
          } else if (userRole === Role.moderator) {
            if (comment.user_id) {
              const author = await this.prisma.user.findUnique({
                where: { id: comment.user_id },
                select: { role: true },
              });
              if (author?.role === Role.admin) {
                throw createHttpException(errors.common.forbidden);
              }
            }
          } else {
            throw new ForbiddenException(
              'You do not have permission to deactivate this comment',
            );
          }
        } else {
          throw new ForbiddenException(
            'You do not have permission to deactivate this comment',
          );
        }
      }
    }

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { is_active: false },
    });

    // Prune unread reply notifications targeting this deactivated comment
    await this.prisma.notification.deleteMany({
      where: {
        subject: NotificationSubject.comment,
        target_id: commentId,
        is_read: false,
      },
    });

    return { message: 'Comment deactivated successfully' };
  }

  // ---------------------------------------------------------------------------

  /**
   * Update an existing comment text.
   * Authorized only for the comment author. Deactivated comments cannot be edited.
   */
  async updateComment(
    recipeId: number,
    commentId: number,
    userId: number,
    dto: UpdateCommentDto,
  ) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment || comment.recipe_id !== recipeId) {
      throw new NotFoundException('Comment not found');
    }

    if (!comment.is_active) {
      throw new BadRequestException('Cannot edit a deactivated comment');
    }

    if (comment.user_id !== userId) {
      throw new ForbiddenException(
        'You do not have permission to edit this comment',
      );
    }

    return await this.prisma.comment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        is_edited: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar_url: true,
          },
        },
      },
    });
  }
}
