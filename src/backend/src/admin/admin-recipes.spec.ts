import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import {
  RecipePrivacy,
  Role,
  ReportStatus,
  ReportSubject,
} from '@prisma/client';
import { AdminRecipesController } from './admin-recipes.controller';
import { AdminRecipeQueryDto, AdminRecipeStatus } from './dto/admin-recipe-query.dto';
import { RecipeService } from '../recipe/recipe.service';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import { RecipeProjection } from '../recipe/recipe.projection';
import { ProductionConfig } from '../common/config/production.config';
import { NotificationEmit } from '../notifications/notification-emit';
import { RecipeSortBy } from '../recipe/dto/filter-recipe.dto';
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
          sort_by: RecipeSortBy.title,
        };
        const caller = { id: 1, role: Role.admin };

        const result = await recipeService.getAdminRecipes(query, caller);

        expect(mockPrisma.$queryRaw).toHaveBeenCalled();
        expect(result.items).toHaveLength(1);
        expect(result.items[0].id).toBe(1);
      });
    });
  });
});
