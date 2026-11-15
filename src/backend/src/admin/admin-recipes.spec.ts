import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  RecipePrivacy,
  Role,
  ReportStatus,
  ReportSubject,
} from '@prisma/client';
import { AdminRecipesController } from './admin-recipes.controller';
import {
  AdminRecipeQueryDto,
  AdminRecipeSortBy,
  AdminRecipeStatus,
} from './dto/admin-recipe-query.dto';
import { RecipeService } from '../recipe/recipe.service';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { VideoProcessingService } from '../common/services/video-processing.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import { RecipeProjection } from '../recipe/recipe.projection';
import { ProductionConfig } from '../common/config/production.config';
import { NotificationEmit } from '../notifications/notification-emit';
import { RecipeSortOrder } from '../recipe/dto/filter-recipe.dto';
import { JwtService } from '@nestjs/jwt';

describe('AdminRecipesController & RecipeService.getAdminRecipes', () => {
  let controller: AdminRecipesController;
  let recipeService: RecipeService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    recipe: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
    },
  };

  const mockTranslationService = {
    translate: jest.fn(),
    detectLanguage: jest.fn(),
  };

  const mockProductionConfig = {
    isProduction: jest.fn().mockReturnValue(false),
  };

  const mockNotificationEmit = {
    notification: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const sampleRawRecipe = {
    id: 1,
    course: 'main_course',
    difficulty: 'medium',
    prep_time: 15,
    cook_time: 30,
    total_time: 45,
    servings: 4,
    source_lang: 'en',
    privacy: RecipePrivacy.public,
    is_active: true,
    user_id: 10,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    user: {
      id: 10,
      username: 'chef',
      avatar_url: '/uploads/avatars/chef.webp',
    },
    translations: [
      {
        locale: 'en',
        title: 'Classic Carbonara',
        description: 'Rich Roman pasta dish',
        instructions: 'Cook pasta, mix eggs and cheese.',
        is_machine_translated: false,
      },
    ],
    recipe_tags: [],
    likes: [],
    _count: { likes: 5, comments: 2 },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminRecipesController],
      providers: [
        RecipeService,
        RecipeProjection,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TranslationService, useValue: mockTranslationService },
        { provide: ProductionConfig, useValue: mockProductionConfig },
        { provide: NotificationEmit, useValue: mockNotificationEmit },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: ImageProcessingService,
          useValue: { processRecipeImageFile: jest.fn() },
        },
        {
          provide: VideoProcessingService,
          useValue: { processVideoFile: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<AdminRecipesController>(AdminRecipesController);
    recipeService = module.get<RecipeService>(RecipeService);
  });

  describe('AdminRecipesController', () => {
    it('delegates query and caller to recipeService.getAdminRecipes', async () => {
      const mockResult: any = {
        items: [],
        page: 1,
        limit: 20,
        total: 0,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      jest.spyOn(recipeService, 'getAdminRecipes').mockResolvedValue(mockResult);

      const query: AdminRecipeQueryDto = {
        status: AdminRecipeStatus.all,
        page: 1,
        limit: 20,
      };
      const caller = { id: 1, role: 'admin' };

      const result = await controller.getAdminRecipes(query, caller);
      expect(result).toBe(mockResult);
      expect(recipeService.getAdminRecipes).toHaveBeenCalledWith(query, caller);
    });
  });

  describe('RecipeService.getAdminRecipes', () => {
    it('throws ForbiddenException if caller has non-staff role', async () => {
      const query: AdminRecipeQueryDto = { status: AdminRecipeStatus.all };
      const caller = { id: 5, role: 'user' };

      await expect(recipeService.getAdminRecipes(query, caller)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException if caller has no role', async () => {
      const query: AdminRecipeQueryDto = { status: AdminRecipeStatus.all };
      const caller = { id: 5 };

      await expect(
        recipeService.getAdminRecipes(query, caller as any),
      ).rejects.toThrow(ForbiddenException);
    });

    describe('Administrator visibility', () => {
      it('returns all recipes across all privacy tiers and status=all by default', async () => {
        mockPrisma.recipe.findMany.mockResolvedValue([sampleRawRecipe]);
        mockPrisma.recipe.count.mockResolvedValue(1);

        const query: AdminRecipeQueryDto = { status: AdminRecipeStatus.all };
        const caller = { id: 1, role: Role.admin };

        const result = await recipeService.getAdminRecipes(query, caller);

        expect(result.items).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {},
            take: 20,
            skip: 0,
          }),
        );
      });

      it('filters is_active: true when status=active', async () => {
        mockPrisma.recipe.findMany.mockResolvedValue([sampleRawRecipe]);
        mockPrisma.recipe.count.mockResolvedValue(1);

        const query: AdminRecipeQueryDto = { status: AdminRecipeStatus.active };
        const caller = { id: 1, role: Role.admin };

        await recipeService.getAdminRecipes(query, caller);

        expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { is_active: true },
          }),
        );
      });

      it('filters is_active: false when status=inactive', async () => {
        mockPrisma.recipe.findMany.mockResolvedValue([]);
        mockPrisma.recipe.count.mockResolvedValue(0);

        const query: AdminRecipeQueryDto = { status: AdminRecipeStatus.inactive };
        const caller = { id: 1, role: Role.admin };

        await recipeService.getAdminRecipes(query, caller);

        expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { is_active: false },
          }),
        );
      });
    });

    describe('Moderator visibility', () => {
      it('excludes private recipes when no pending reports exist', async () => {
        mockPrisma.report.findMany.mockResolvedValue([]);
        mockPrisma.recipe.findMany.mockResolvedValue([sampleRawRecipe]);
        mockPrisma.recipe.count.mockResolvedValue(1);

        const query: AdminRecipeQueryDto = { status: AdminRecipeStatus.all };
        const caller = { id: 2, role: Role.moderator };

        await recipeService.getAdminRecipes(query, caller);

        expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              AND: [
                {
                  OR: [
                    { privacy: RecipePrivacy.public },
                    { privacy: RecipePrivacy.friends_only },
                    { user_id: 2 },
                  ],
                },
              ],
            },
          }),
        );
      });

      it('includes private recipes that have active pending reports on recipe or comment', async () => {
        // Pending report on recipe 42
        mockPrisma.report.findMany
          .mockResolvedValueOnce([{ target_id: 42 }]) // recipe reports
          .mockResolvedValueOnce([{ target_id: 101 }]); // comment reports
        // Comment 101 belongs to recipe 88
        mockPrisma.comment.findMany.mockResolvedValueOnce([{ recipe_id: 88 }]);

        mockPrisma.recipe.findMany.mockResolvedValue([]);
        mockPrisma.recipe.count.mockResolvedValue(0);

        const query: AdminRecipeQueryDto = { status: AdminRecipeStatus.all };
        const caller = { id: 2, role: Role.moderator };

        await recipeService.getAdminRecipes(query, caller);

        expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              AND: [
                {
                  OR: [
                    { privacy: RecipePrivacy.public },
                    { privacy: RecipePrivacy.friends_only },
                    { user_id: 2 },
                    {
                      privacy: RecipePrivacy.private,
                      id: { in: [42, 88] },
                    },
                  ],
                },
              ],
            },
          }),
        );
      });
    });

    describe('Search and catalog filtering', () => {
      it('applies search keyword, course, and difficulty filters', async () => {
        mockPrisma.recipe.findMany.mockResolvedValue([]);
        mockPrisma.recipe.count.mockResolvedValue(0);

        const query: AdminRecipeQueryDto = {
          status: AdminRecipeStatus.all,
          search: 'pasta',
          course: 'main_course' as any,
          difficulty: 'easy' as any,
        };
        const caller = { id: 1, role: Role.admin };

        await recipeService.getAdminRecipes(query, caller);

        expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              course: 'main_course',
              difficulty: 'easy',
              AND: [
                {
                  translations: {
                    some: {
                      OR: [
                        { title: { contains: 'pasta', mode: 'insensitive' } },
                        {
                          description: {
                            contains: 'pasta',
                            mode: 'insensitive',
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          }),
        );
      });
    });

    describe('Sorting by title', () => {
      it('executes title sorting query and hydrates summary responses', async () => {
        mockPrisma.$queryRaw.mockResolvedValueOnce([{ id: 1 }]);
        mockPrisma.recipe.count.mockResolvedValueOnce(1);
        mockPrisma.recipe.findMany.mockResolvedValueOnce([sampleRawRecipe]);

        const query: AdminRecipeQueryDto = {
          status: AdminRecipeStatus.all,
          sort_by: AdminRecipeSortBy.title,
        };
        const caller = { id: 1, role: Role.admin };

        const result = await recipeService.getAdminRecipes(query, caller);

        expect(mockPrisma.$queryRaw).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe(1);
      });
    });

    describe('Report counters, reported_only filter, and report-count sorting (#222)', () => {
      it('hydrates reports_count, pending_reports_count, has_pending_reports, and latest_pending_report_id strictly for subject=recipe', async () => {
        mockPrisma.recipe.findMany.mockResolvedValueOnce([sampleRawRecipe]);
        mockPrisma.recipe.count.mockResolvedValueOnce(1);
        mockPrisma.report.groupBy.mockResolvedValueOnce([
          { target_id: 1, status: ReportStatus.pending, _count: { id: 2 } },
          { target_id: 1, status: ReportStatus.dismissed, _count: { id: 3 } },
        ]);
        mockPrisma.report.findMany.mockResolvedValueOnce([
          { id: 502, target_id: 1 },
          { id: 501, target_id: 1 },
        ]);

        const result = await recipeService.getAdminRecipes(
          { status: AdminRecipeStatus.all },
          { id: 1, role: Role.admin },
        );

        expect(mockPrisma.report.groupBy).toHaveBeenCalledWith({
          by: ['target_id', 'status'],
          where: {
            subject: ReportSubject.recipe,
            target_id: { in: [1] },
          },
          _count: { id: true },
        });
        expect(result.items[0]).toMatchObject({
          id: 1,
          reports_count: 5,
          pending_reports_count: 2,
          has_pending_reports: true,
          latest_pending_report_id: 502,
        });
      });

      it('returns empty page immediately when reported_only=true and zero pending recipe reports exist', async () => {
        mockPrisma.report.findMany.mockResolvedValueOnce([]);

        const result = await recipeService.getAdminRecipes(
          { status: AdminRecipeStatus.all, reported_only: true },
          { id: 1, role: Role.admin },
        );

        expect(result).toEqual({
          items: [],
          total: 0,
          page: 1,
          limit: 20,
          total_pages: 0,
          has_next_page: false,
          has_prev_page: false,
        });
        expect(mockPrisma.recipe.findMany).not.toHaveBeenCalled();
      });

      it('defaults reported_only=true to pending_reports_count DESC and preserves moderator private recipe visibility', async () => {
        const recipe1 = {
          ...sampleRawRecipe,
          id: 1,
          created_at: new Date('2026-01-01'),
        };
        const recipe2 = {
          ...sampleRawRecipe,
          id: 2,
          privacy: RecipePrivacy.private,
          created_at: new Date('2026-01-02'),
        };

        // 1st findMany: moderator privacy recipe reports
        // 2nd findMany: moderator privacy comment reports -> none
        // 3rd findMany: reported_only pending recipe target IDs
        // 4th findMany: latestPendingId lookup in getBatchReportMetrics
        mockPrisma.report.findMany
          .mockResolvedValueOnce([{ target_id: 1 }, { target_id: 2 }])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ target_id: 1 }, { target_id: 2 }])
          .mockResolvedValueOnce([
            { id: 802, target_id: 2 },
            { id: 801, target_id: 1 },
          ]);
        mockPrisma.recipe.findMany.mockResolvedValueOnce([recipe1, recipe2]);
        mockPrisma.report.groupBy.mockResolvedValueOnce([
          { target_id: 1, status: ReportStatus.pending, _count: { id: 1 } },
          { target_id: 1, status: ReportStatus.dismissed, _count: { id: 4 } },
          { target_id: 2, status: ReportStatus.pending, _count: { id: 3 } },
        ]);

        const result = await recipeService.getAdminRecipes(
          { status: AdminRecipeStatus.all, reported_only: true },
          { id: 2, role: Role.moderator },
        );

        expect(result.items.map((i) => i.id)).toEqual([2, 1]);
        expect(result.items[0]).toMatchObject({
          id: 2,
          pending_reports_count: 3,
          reports_count: 3,
          latest_pending_report_id: 802,
        });
        expect(result.items[1]).toMatchObject({
          id: 1,
          pending_reports_count: 1,
          reports_count: 5,
          latest_pending_report_id: 801,
        });
      });

      it('sorts by reports_count (asc/desc) with deterministic created_at DESC, id DESC tie-breaking', async () => {
        const r1 = {
          ...sampleRawRecipe,
          id: 1,
          created_at: new Date('2026-01-01'),
        };
        const r2 = {
          ...sampleRawRecipe,
          id: 2,
          created_at: new Date('2026-01-02'),
        };
        const r3 = {
          ...sampleRawRecipe,
          id: 3,
          created_at: new Date('2026-01-02'),
        };

        const groupRows = [
          { target_id: 1, status: ReportStatus.dismissed, _count: { id: 5 } },
          { target_id: 2, status: ReportStatus.pending, _count: { id: 2 } },
          { target_id: 3, status: ReportStatus.action_taken, _count: { id: 2 } },
        ];

        // DESC: r1 (5) -> r3 (2, newer/higher id) -> r2 (2)
        mockPrisma.recipe.findMany.mockResolvedValueOnce([r1, r2, r3]);
        mockPrisma.report.groupBy.mockResolvedValueOnce(groupRows);
        mockPrisma.report.findMany.mockResolvedValueOnce([
          { id: 902, target_id: 2 },
        ]);

        const descRes = await recipeService.getAdminRecipes(
          {
            status: AdminRecipeStatus.all,
            sort_by: AdminRecipeSortBy.reports_count,
          },
          { id: 1, role: Role.admin },
        );
        expect(descRes.items.map((i) => i.id)).toEqual([1, 3, 2]);

        // ASC: tie-break still deterministic (created_at DESC, id DESC) -> r3 (2), r2 (2), r1 (5)
        mockPrisma.recipe.findMany.mockResolvedValueOnce([r1, r2, r3]);
        mockPrisma.report.groupBy.mockResolvedValueOnce(groupRows);
        mockPrisma.report.findMany.mockResolvedValueOnce([
          { id: 902, target_id: 2 },
        ]);

        const ascRes = await recipeService.getAdminRecipes(
          {
            status: AdminRecipeStatus.all,
            sort_by: AdminRecipeSortBy.reports_count,
            sort_order: RecipeSortOrder.asc,
          },
          { id: 1, role: Role.admin },
        );
        expect(ascRes.items.map((i) => i.id)).toEqual([3, 2, 1]);
      });
    });
  });
});
