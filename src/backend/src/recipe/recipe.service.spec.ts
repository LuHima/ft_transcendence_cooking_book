import {
  BadRequestException,
  NotFoundException,
  HttpException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Course,
  RecipeDifficulty,
  NotificationAction,
  NotificationSubject,
  TranslationStatus,
  UnitOfMeasure,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { FilterRecipeDto } from './dto/filter-recipe.dto';
import { RecipeService } from './recipe.service';
import { ProductionConfig } from '../common/config/production.config';
import { RECIPE_UPLOADS_DIR } from '../common/config/upload-paths';
import { NotificationEmit } from '../notifications/notification-emit';
import * as fs from 'fs';
import { join } from 'path';

describe('RecipeService', () => {
  let service: RecipeService;
  let prisma: PrismaService;
  let translationService: TranslationService;

  const mockProductionConfig = {
    isProduction: jest.fn().mockReturnValue(false),
  };

  const mockNotificationEmit = {
    notification: jest.fn(),
  };

  const mockPrisma = {
    $transaction: jest.fn(),
    recipe: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    recipeTranslation: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    recipeStepTranslation: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    recipeStep: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    recipeMedia: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    ingredient: {
      findMany: jest.fn(),
    },
    tag: {
      findMany: jest.fn(),
    },
    like: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    comment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const mockTranslationService = {
    verifySourceLanguage: jest.fn(),
    translateBatch: jest.fn(),
  };

  const sampleDto: CreateRecipeDto = {
    title: 'Pasta al Pesto Fresco Genovese',
    description: 'Un piatto tipico ligure profumato al basilico fresco.',
    preservation: 'Conservare in frigo per 2 giorni.',
    tips: 'Non scaldare mai il pesto direttamente.',
    course: Course.first_course,
    difficulty: RecipeDifficulty.easy,
    prep_time: 15,
    cook_time: 10,
    servings: 4,
    source_lang: 'it',
    steps: [
      {
        step_number: 1,
        title: 'Pestare il basilico',
        description: 'Pesta il basilico con pinoli, aglio e olio extravergine.',
        duration: 10,
      },
    ],
    ingredients: [
      {
        ingredient_id: 1,
        quantity: 350,
        unit: UnitOfMeasure.g,
      },
    ],
    tag_ids: [1],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TranslationService, useValue: mockTranslationService },
        { provide: ProductionConfig, useValue: mockProductionConfig },
        { provide: NotificationEmit, useValue: mockNotificationEmit },
      ],
    }).compile();

    service = module.get<RecipeService>(RecipeService);
    prisma = module.get<PrismaService>(PrismaService);
    translationService = module.get<TranslationService>(TranslationService);

    jest.clearAllMocks();
    mockNotificationEmit.notification.mockReset();
    mockPrisma.notification.deleteMany.mockReset();
    mockPrisma.ingredient.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.tag.findMany.mockResolvedValue([{ id: 1 }]);
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(mockPrisma);
      }
      return cb;
    });
  });

  describe('getAllRecipe', () => {
    const mockDbRecipes = [
      {
        id: 1,
        course: Course.first_course,
        difficulty: RecipeDifficulty.medium,
        prep_time: 15,
        cook_time: 10,
        total_time: 25,
        servings: 4,
        source_lang: 'it',
        translation_status: TranslationStatus.completed,
        cover_image_url: '/uploads/recipes/cover.webp',
        video_url: null,
        created_at: new Date('2026-10-09T18:00:00.000Z'),
        updated_at: null,
        translations: [
          { locale: 'it', title: 'Carbonara', description: 'Classica' },
          { locale: 'en', title: 'Carbonara English', description: 'Classic' },
        ],
        recipe_tags: [
          {
            tag: {
              id: 1,
              slug: 'traditional',
              translations: [
                { locale: 'it', name: 'Tradizionale' },
                { locale: 'en', name: 'Traditional' },
              ],
            },
          },
        ],
        user: {
          id: 1,
          username: 'chef_mario',
          avatar_url: '/uploads/avatars/chef_mario.webp',
        },
        _count: {
          likes: 5,
          comments: 2,
        },
        likes: [],
      },
    ];

    it('returns paginated envelope with default page=1 and limit=20 and lightweight cards', async () => {
      mockPrisma.recipe.findMany.mockResolvedValueOnce(mockDbRecipes);
      mockPrisma.recipe.count.mockResolvedValueOnce(1);

      const result = await service.getAllRecipe();

      expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        orderBy: { created_at: 'desc' },
        include: expect.objectContaining({
          translations: true,
          user: { select: { id: true, username: true, avatar_url: true } },
          recipe_tags: {
            include: { tag: { include: { translations: true } } },
          },
          _count: expect.any(Object),
        }),
      });
      expect(mockPrisma.recipe.count).toHaveBeenCalledWith({});

      expect(result).toEqual({
        items: [
          {
            id: 1,
            course: Course.first_course,
            difficulty: RecipeDifficulty.medium,
            prep_time: 15,
            cook_time: 10,
            total_time: 25,
            servings: 4,
            source_lang: 'it',
            translation_status: TranslationStatus.completed,
            cover_image_url: '/uploads/recipes/cover.webp',
            video_url: null,
            created_at: expect.any(Date),
            updated_at: null,
            author: {
              id: 1,
              username: 'chef_mario',
              avatar_url: '/uploads/avatars/chef_mario.webp',
            },
            title: 'Carbonara',
            description: 'Classica',
            tags: [
              {
                id: 1,
                slug: 'traditional',
                name: 'Tradizionale',
                resolved_lang: 'it',
              },
            ],
            likes_count: 5,
            comments_count: 2,
            is_liked: false,
            resolved_lang: 'it',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      });
      // Steps and ingredients are omitted from the summary card
      expect((result.items[0] as any).steps).toBeUndefined();
      expect((result.items[0] as any).ingredients).toBeUndefined();
    });

    it('calculates skip, take, total_pages, and navigation flags for custom page and limit', async () => {
      mockPrisma.recipe.findMany.mockResolvedValueOnce(mockDbRecipes);
      mockPrisma.recipe.count.mockResolvedValueOnce(45);

      const result = await service.getAllRecipe({ page: 2, limit: 10 });

      expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.total).toBe(45);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total_pages).toBe(5);
      expect(result.has_next_page).toBe(true);
      expect(result.has_prev_page).toBe(true);
    });

    it('projects localized title, description, and tags when lang is specified', async () => {
      mockPrisma.recipe.findMany.mockResolvedValueOnce(mockDbRecipes);
      mockPrisma.recipe.count.mockResolvedValueOnce(1);

      const result = await service.getAllRecipe({ lang: 'en' });

      expect(result.items[0].title).toBe('Carbonara English');
      expect(result.items[0].description).toBe('Classic');
      expect(result.items[0].tags[0].name).toBe('Traditional');
      expect(result.items[0].resolved_lang).toBe('en');
    });

    it('filters recipes by course, difficulty, author_id, max_time, tag_ids, and search keyword', async () => {
      mockPrisma.recipe.findMany.mockResolvedValueOnce(mockDbRecipes);
      mockPrisma.recipe.count.mockResolvedValueOnce(1);

      const filters: FilterRecipeDto = {
        course: Course.main_course,
        difficulty: RecipeDifficulty.easy,
        author_id: 5,
        max_time: 45,
        tag_ids: [1, 2],
        search: 'pasta',
      };

      const result = await service.getAllRecipe(filters);

      const expectedWhere = {
        course: Course.main_course,
        difficulty: RecipeDifficulty.easy,
        user_id: 5,
        total_time: { lte: 45 },
        recipe_tags: {
          some: {
            tag_id: { in: [1, 2] },
          },
        },
        translations: {
          some: {
            OR: [
              { title: { contains: 'pasta', mode: 'insensitive' } },
              { description: { contains: 'pasta', mode: 'insensitive' } },
            ],
          },
        },
      };

      expect(mockPrisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expectedWhere,
        }),
      );
      expect(mockPrisma.recipe.count).toHaveBeenCalledWith({
        where: expectedWhere,
      });
      expect(result.total).toBe(1);
    });

    it('populates is_liked=true when currentUserId has liked the recipe', async () => {
      const mockWithUserLike = [
        {
          ...mockDbRecipes[0],
          likes: [{ user_id: 42 }],
        },
      ];
      mockPrisma.recipe.findMany.mockResolvedValueOnce(mockWithUserLike);
      mockPrisma.recipe.count.mockResolvedValueOnce(1);

      const result = await service.getAllRecipe({}, 42);

      expect(result.items[0].is_liked).toBe(true);
    });
  });

  describe('createRecipe', () => {
    it('throws BadRequestException when step numbers are duplicated', async () => {
      const recipeWithDuplicateSteps = {
        ...sampleDto,
        steps: [sampleDto.steps[0], { ...sampleDto.steps[0], step_number: 1 }],
      };

      await expect(
        service.createRecipe(recipeWithDuplicateSteps, 1),
      ).rejects.toThrow(
        new BadRequestException(
          'Duplicate step number: 1. Each step number must be unique.',
        ),
      );

      expect(
        mockTranslationService.verifySourceLanguage,
      ).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when step numbers are not consecutive', async () => {
      const recipeWithNonConsecutiveSteps = {
        ...sampleDto,
        steps: [
          sampleDto.steps[0],
          { ...sampleDto.steps[0], step_number: 2 },
          { ...sampleDto.steps[0], step_number: 4 },
        ],
      };

      await expect(
        service.createRecipe(recipeWithNonConsecutiveSteps, 1),
      ).rejects.toThrow(
        new BadRequestException(
          'Step numbers must be consecutive starting at 1. Missing step number: 3.',
        ),
      );

      expect(
        mockTranslationService.verifySourceLanguage,
      ).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when ingredient IDs are duplicated', async () => {
      const recipeWithDuplicateIngredients = {
        ...sampleDto,
        ingredients: [
          sampleDto.ingredients[0],
          { ...sampleDto.ingredients[0], quantity: 100 },
        ],
      };

      await expect(
        service.createRecipe(recipeWithDuplicateIngredients, 1),
      ).rejects.toThrow(
        new BadRequestException(
          'Duplicate ingredient ID: 1. Each ingredient may only be added once.',
        ),
      );

      expect(
        mockTranslationService.verifySourceLanguage,
      ).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when tag IDs are duplicated', async () => {
      const recipeWithDuplicateTags = {
        ...sampleDto,
        tag_ids: [1, 1],
      };

      await expect(
        service.createRecipe(recipeWithDuplicateTags, 1),
      ).rejects.toThrow(
        new BadRequestException(
          'Duplicate tag ID: 1. Each tag may only be added once.',
        ),
      );

      expect(
        mockTranslationService.verifySourceLanguage,
      ).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException and does not execute transaction if language verification fails', async () => {
      mockTranslationService.verifySourceLanguage.mockRejectedValueOnce(
        new BadRequestException(
          "Declared language 'it' does not match detected language 'en'",
        ),
      );

      await expect(service.createRecipe(sampleDto, 1)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockTranslationService.verifySourceLanguage).toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if any ingredient_id does not exist in catalog', async () => {
      mockTranslationService.verifySourceLanguage.mockResolvedValueOnce(
        undefined,
      );
      mockPrisma.ingredient.findMany.mockResolvedValueOnce([]); // no existing ingredient

      await expect(service.createRecipe(sampleDto, 1)).rejects.toThrow(
        new BadRequestException(
          'Ingredient with ID 1 does not exist in catalog',
        ),
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if any tag_id does not exist in catalog', async () => {
      mockTranslationService.verifySourceLanguage.mockResolvedValueOnce(
        undefined,
      );
      mockPrisma.ingredient.findMany.mockResolvedValueOnce([{ id: 1 }]);
      mockPrisma.tag.findMany.mockResolvedValueOnce([]); // tag 1 does not exist

      await expect(service.createRecipe(sampleDto, 1)).rejects.toThrow(
        new BadRequestException('Tag with ID 1 does not exist in catalog'),
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('calculates total_time, translates to remaining locales, and creates recipe atomically with completed status', async () => {
      mockTranslationService.verifySourceLanguage.mockResolvedValueOnce(
        undefined,
      );

      mockTranslationService.translateBatch.mockImplementation(
        async (texts: string[], source: string, target: string) => {
          if (target === 'en') {
            return {
              translations: [
                'Fresh Genoese Pesto Pasta',
                'A typical Ligurian dish scented with fresh basil.',
                'Refrigerate for 2 days.',
                'Never heat pesto directly.',
                'Crush basil',
                'Crush basil with pine nuts, garlic and olive oil.',
              ],
              success: true,
            };
          }
          if (target === 'fr') {
            return {
              translations: [
                'Pâtes au Pesto Frais Génois',
                'Un plat ligure typique parfumé au basilic frais.',
                'Conserver au frais pendant 2 jours.',
                'Ne jamais chauffer le pesto directement.',
                'Écraser le basilic',
                "Écrasez le basilic avec des pignons, de l'ail et de l'huile d'olive.",
              ],
              success: true,
            };
          }
          return { translations: texts, success: true };
        },
      );

      const mockCreatedRecipe = {
        id: 42,
        user_id: 1,
        prep_time: 15,
        cook_time: 10,
        total_time: 25,
        translation_status: 'completed',
      };

      const mockDetailRecipe = {
        id: 42,
        user_id: 1,
        title: sampleDto.title,
        prep_time: 15,
        cook_time: 10,
        total_time: 25,
        translation_status: 'completed',
        resolved_lang: 'it',
      };

      jest
        .spyOn(service, 'getRecipeById')
        .mockResolvedValueOnce(mockDetailRecipe as any);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return mockCreatedRecipe;
      });
      mockPrisma.recipe.create.mockResolvedValueOnce(mockCreatedRecipe);

      const result = await service.createRecipe(sampleDto, 1);

      expect(mockTranslationService.verifySourceLanguage).toHaveBeenCalled();
      expect(mockTranslationService.translateBatch).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total_time: 25,
            translation_status: 'completed',
          }),
        }),
      );
      expect(service.getRecipeById).toHaveBeenCalledWith(42, 'it', 1);
      expect(result).toEqual(mockDetailRecipe);
    });

    it('does not persist target translations when translation fails', async () => {
      mockTranslationService.verifySourceLanguage.mockResolvedValueOnce(
        undefined,
      );

      mockTranslationService.translateBatch.mockResolvedValue({
        translations: [],
        success: false,
      });

      const mockFailedRecipe = {
        id: 43,
        user_id: 1,
        total_time: 25,
        translation_status: 'failed',
      };

      const mockFailedDetailRecipe = {
        id: 43,
        user_id: 1,
        title: sampleDto.title,
        total_time: 25,
        translation_status: 'failed',
        resolved_lang: 'it',
      };

      jest
        .spyOn(service, 'getRecipeById')
        .mockResolvedValueOnce(mockFailedDetailRecipe as any);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return mockFailedRecipe;
      });
      mockPrisma.recipe.create.mockResolvedValueOnce(mockFailedRecipe);

      const result = await service.createRecipe(sampleDto, 1);

      expect(mockTranslationService.translateBatch).toHaveBeenCalled();
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.recipe.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            translation_status: 'failed',
            translations: {
              create: [
                expect.objectContaining({
                  locale: 'it',
                  title: sampleDto.title,
                }),
              ],
            },
          }),
        }),
      );
      const createCall = mockPrisma.recipe.create.mock.calls[0][0];
      expect(createCall.data.steps.create[0].translations.create).toEqual([
        expect.objectContaining({ locale: 'it' }),
      ]);
      expect(service.getRecipeById).toHaveBeenCalledWith(43, 'it', 1);
      expect(result).toEqual(mockFailedDetailRecipe);
    });
  });

  describe('getRecipeById', () => {
    it('throws NotFoundException when recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.getRecipeById(999, 'it')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns flattened localized recipe projection with ordered steps when requested language matches', async () => {
      const mockDbRecipe = {
        id: 1,
        course: Course.first_course,
        difficulty: RecipeDifficulty.medium,
        prep_time: 15,
        cook_time: 10,
        total_time: 25,
        servings: 4,
        source_lang: 'it',
        translation_status: 'completed',
        cover_image_url: 'https://example.com/cover.jpg',
        video_url: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        user: {
          id: 10,
          username: 'chef_mario',
          avatar_url: 'https://example.com/mario.jpg',
        },
        translations: [
          {
            locale: 'it',
            title: 'Pasta alla Carbonara',
            description: 'La vera carbonara romana.',
            preservation: 'Consumare calda.',
            tips: 'Niente panna!',
          },
          {
            locale: 'en',
            title: 'Spaghetti Carbonara',
            description: 'Authentic Roman carbonara.',
            preservation: 'Serve hot.',
            tips: 'No cream!',
          },
        ],
        steps: [
          {
            id: 102,
            step_number: 2,
            duration: 10,
            image_url: null,
            translations: [
              {
                locale: 'it',
                title: 'Cuocere',
                description: 'Cuoci la pasta.',
              },
              { locale: 'en', title: 'Cook', description: 'Cook pasta.' },
            ],
          },
          {
            id: 101,
            step_number: 1,
            duration: 5,
            image_url: null,
            translations: [
              {
                locale: 'it',
                title: 'Rosolare',
                description: 'Rosola il guanciale.',
              },
              { locale: 'en', title: 'Brown', description: 'Brown guanciale.' },
            ],
          },
        ],
        recipe_ingredients: [
          {
            ingredient_id: 5,
            quantity: 150,
            unit: UnitOfMeasure.g,
            notes: {
              it: 'a listarelle',
              en: 'sliced strips',
              fr: 'en lanières',
            },
            ingredient: {
              id: 5,
              slug: 'guanciale',
              category: 'meat_poultry',
              translations: [
                { locale: 'it', name: 'Guanciale' },
                { locale: 'en', name: 'Cured Pork Jowl' },
              ],
            },
          },
        ],
        recipe_tags: [
          {
            tag: {
              id: 1,
              slug: 'traditional',
              translations: [
                { locale: 'it', name: 'Tradizionale' },
                { locale: 'en', name: 'Traditional' },
              ],
            },
          },
        ],
        recipe_media: [
          {
            id: 1,
            url: 'https://example.com/cover.jpg',
            media_type: 'image',
            order: 0,
          },
        ],
      };

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(mockDbRecipe);

      const result = await service.getRecipeById(1, 'en');

      expect(mockPrisma.recipe.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      });

      expect(result.id).toBe(1);
      expect(result.title).toBe('Spaghetti Carbonara');
      expect(result.description).toBe('Authentic Roman carbonara.');
      expect(result.preservation).toBe('Serve hot.');
      expect(result.tips).toBe('No cream!');
      expect(result.author).toEqual({
        id: 10,
        username: 'chef_mario',
        avatar_url: 'https://example.com/mario.jpg',
      });

      // Steps must be ordered by step_number ascending (1 then 2)
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].step_number).toBe(1);
      expect(result.steps[0].title).toBe('Brown');
      expect(result.steps[0].description).toBe('Brown guanciale.');
      expect(result.steps[1].step_number).toBe(2);
      expect(result.steps[1].title).toBe('Cook');
      expect(result.steps[1].description).toBe('Cook pasta.');

      // Ingredients must be localized in English with English notes
      expect(result.ingredients).toHaveLength(1);
      expect(result.ingredients[0].id).toBe(5);
      expect(result.ingredients[0].name).toBe('Cured Pork Jowl');
      expect(result.ingredients[0].quantity).toBe(150);
      expect(result.ingredients[0].unit).toBe(UnitOfMeasure.g);
      expect(result.ingredients[0].notes).toBe('sliced strips');

      // Tags must be localized in English
      expect(result.tags).toHaveLength(1);
      expect(result.tags[0].slug).toBe('traditional');
      expect(result.tags[0].name).toBe('Traditional');
      expect(result.tags[0].resolved_lang).toBe('en');
      expect(result.ingredients[0].resolved_lang).toBe('en');
      expect(result.resolved_lang).toBe('en');
    });

    it('gracefully falls back to source_lang when requested translation locale is not available', async () => {
      const mockItalianOnlyRecipe = {
        id: 2,
        course: Course.dessert,
        difficulty: RecipeDifficulty.easy,
        prep_time: 20,
        cook_time: 0,
        total_time: 20,
        servings: 6,
        source_lang: 'it',
        translation_status: 'failed',
        cover_image_url: null,
        video_url: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: null,
        user: null,
        translations: [
          {
            locale: 'it',
            title: 'Tiramisù Tradizionale',
            description: 'Il classico tiramisù veneto con savoiardi.',
            preservation: '2 giorni in frigo.',
            tips: 'Usa caffè freddo.',
          },
        ],
        steps: [
          {
            id: 201,
            step_number: 1,
            duration: 10,
            image_url: null,
            translations: [
              {
                locale: 'it',
                title: 'Preparare la crema',
                description: 'Montare uova e mascarpone.',
              },
            ],
          },
        ],
        recipe_ingredients: [
          {
            ingredient_id: 8,
            quantity: 500,
            unit: UnitOfMeasure.g,
            notes: { it: 'fresco e cremoso' },
            ingredient: {
              id: 8,
              slug: 'mascarpone',
              category: 'dairy_eggs',
              translations: [{ locale: 'it', name: 'Mascarpone' }],
            },
          },
        ],
        recipe_tags: [
          {
            tag: {
              id: 2,
              slug: 'vegetarian',
              translations: [{ locale: 'it', name: 'Vegetariano' }],
            },
          },
        ],
        recipe_media: [],
      };

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(mockItalianOnlyRecipe);

      const result = await service.getRecipeById(2, 'fr');

      expect(result.id).toBe(2);
      expect(result.title).toBe('Tiramisù Tradizionale');
      expect(result.description).toBe(
        'Il classico tiramisù veneto con savoiardi.',
      );
      expect(result.preservation).toBe('2 giorni in frigo.');
      expect(result.tips).toBe('Usa caffè freddo.');

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].title).toBe('Preparare la crema');
      expect(result.steps[0].description).toBe('Montare uova e mascarpone.');

      expect(result.ingredients[0].name).toBe('Mascarpone');
      expect(result.ingredients[0].notes).toBe('fresco e cremoso');

      expect(result.tags[0].name).toBe('Vegetariano');
    });

    it('returns likes_count, active comments_count, and is_liked=true when user liked recipe', async () => {
      const mockRecipeWithSocial = {
        id: 1,
        course: Course.first_course,
        difficulty: RecipeDifficulty.easy,
        prep_time: 10,
        cook_time: 15,
        total_time: 25,
        servings: 2,
        source_lang: 'it',
        translation_status: 'completed',
        cover_image_url: null,
        video_url: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        user: { id: 10, username: 'mario', avatar_url: null },
        translations: [
          { locale: 'it', title: 'Carbonara', description: 'Buona' },
        ],
        steps: [],
        recipe_ingredients: [],
        recipe_tags: [],
        recipe_media: [],
        _count: {
          likes: 12,
          comments: 4,
        },
        likes: [{ user_id: 10 }],
      };
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(mockRecipeWithSocial);

      const result = await service.getRecipeById(1, 'it', 10);

      expect(result.likes_count).toBe(12);
      expect(result.comments_count).toBe(4);
      expect(result.is_liked).toBe(true);
    });

    it('returns likes_count, comments_count, and is_liked=false for unauthenticated guest', async () => {
      const mockRecipeWithSocial = {
        id: 1,
        course: Course.first_course,
        difficulty: RecipeDifficulty.easy,
        prep_time: 10,
        cook_time: 15,
        total_time: 25,
        servings: 2,
        source_lang: 'it',
        translation_status: 'completed',
        cover_image_url: null,
        video_url: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-01T00:00:00Z'),
        user: { id: 10, username: 'mario', avatar_url: null },
        translations: [
          { locale: 'it', title: 'Carbonara', description: 'Buona' },
        ],
        steps: [],
        recipe_ingredients: [],
        recipe_tags: [],
        recipe_media: [],
        _count: {
          likes: 7,
          comments: 2,
        },
        likes: [],
      };
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(mockRecipeWithSocial);

      const result = await service.getRecipeById(1, 'it');

      expect(result.likes_count).toBe(7);
      expect(result.comments_count).toBe(2);
      expect(result.is_liked).toBe(false);
    });
  });

  describe('retryTranslation', () => {
    it('throws NotFoundException when recipe does not exist or user is not author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.retryTranslation(999, 1)).rejects.toThrow(
        NotFoundException,
      );

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
        translation_status: 'failed',
      });

      await expect(service.retryTranslation(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException if translation_status is not failed', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        translation_status: 'completed',
      });

      await expect(service.retryTranslation(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('re-translates canonical source text across target locales, updates translations in db, and sets status to completed', async () => {
      const mockFailedRecipe = {
        id: 1,
        user_id: 1,
        source_lang: 'it',
        translation_status: 'failed',
        translations: [
          {
            recipe_id: 1,
            locale: 'it',
            title: 'Pasta al Pesto Fresco Genovese',
            description: 'Un piatto tipico ligure.',
            preservation: '2 giorni.',
            tips: 'Non scaldare il pesto.',
          },
        ],
        steps: [
          {
            id: 10,
            recipe_id: 1,
            step_number: 1,
            translations: [
              {
                step_id: 10,
                locale: 'it',
                title: 'Pestare',
                description: 'Pesta il basilico.',
              },
            ],
          },
        ],
      };

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(mockFailedRecipe);

      mockTranslationService.translateBatch.mockImplementation(
        async (texts: string[], source: string, target: string) => {
          if (target === 'en') {
            return {
              translations: [
                'Fresh Pesto Pasta',
                'A typical Ligurian dish.',
                '2 days.',
                'Do not heat pesto.',
                'Crush',
                'Crush basil.',
              ],
              success: true,
            };
          }
          if (target === 'fr') {
            return {
              translations: [
                'Pâtes au Pesto',
                'Un plat ligure typique.',
                '2 jours.',
                'Ne pas chauffer le pesto.',
                'Écraser',
                'Écrasez le basilic.',
              ],
              success: true,
            };
          }
          return { translations: texts, success: true };
        },
      );

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return cb;
      });

      const updatedRecipe = {
        ...mockFailedRecipe,
        translation_status: 'completed',
      };
      mockPrisma.recipe.update.mockResolvedValueOnce(updatedRecipe);

      const result = await service.retryTranslation(1, 1);

      expect(mockTranslationService.translateBatch).toHaveBeenCalledTimes(2);
      expect(mockPrisma.recipeTranslation.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.recipeStepTranslation.upsert).toHaveBeenCalledTimes(2);
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ translation_status: 'completed' }),
        }),
      );
      expect(result.translation_status).toBe('completed');
    });

    it('keeps translation_status as failed if translationBatch fails during retry', async () => {
      const mockFailedRecipe = {
        id: 1,
        user_id: 1,
        source_lang: 'it',
        translation_status: 'failed',
        translations: [
          {
            recipe_id: 1,
            locale: 'it',
            title: 'Pasta al Pesto Fresco Genovese',
            description: 'Un piatto tipico ligure.',
            preservation: null,
            tips: null,
          },
        ],
        steps: [
          {
            id: 10,
            recipe_id: 1,
            step_number: 1,
            translations: [
              {
                step_id: 10,
                locale: 'it',
                title: null,
                description: 'Pesta il basilico.',
              },
            ],
          },
        ],
      };

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(mockFailedRecipe);
      mockTranslationService.translateBatch.mockResolvedValueOnce({
        translations: [],
        success: false,
      });

      const failedRecipeResult = {
        ...mockFailedRecipe,
        translation_status: 'failed',
      };
      mockPrisma.recipe.update.mockResolvedValueOnce(failedRecipeResult);

      const result = await service.retryTranslation(1, 1);

      expect(mockTranslationService.translateBatch).toHaveBeenCalled();
      expect(mockPrisma.recipeTranslation.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { translation_status: 'failed' },
      });
      expect(result.translation_status).toBe('failed');
    });
  });

  describe('updateRecipe', () => {
    it('throws NotFoundException when recipe does not exist or user is not author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateRecipe(1, 999, { servings: 4 }),
      ).rejects.toThrow(HttpException);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
      });

      await expect(service.updateRecipe(1, 1, { servings: 4 })).rejects.toThrow(
        HttpException,
      );
    });

    it('updates invariant metrics and recalculates total_time accurately', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        prep_time: 15,
        cook_time: 10,
        total_time: 25,
        servings: 4,
        difficulty: RecipeDifficulty.easy,
        course: Course.first_course,
        source_lang: 'it',
      };

      const mockUpdatedDetail = {
        ...existingRecipe,
        prep_time: 25,
        total_time: 35,
        servings: 6,
        difficulty: RecipeDifficulty.hard,
        resolved_lang: 'it',
      };

      jest
        .spyOn(service, 'getRecipeById')
        .mockResolvedValueOnce(mockUpdatedDetail as any);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(existingRecipe);

      const updateData = {
        prep_time: 25,
        servings: 6,
        difficulty: RecipeDifficulty.hard,
      };

      mockPrisma.recipe.update.mockImplementation(async ({ data }: any) => {
        return {
          ...existingRecipe,
          ...data,
        };
      });

      const result = await service.updateRecipe(1, 1, updateData);

      expect(mockPrisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            prep_time: 25,
            total_time: 35,
            servings: 6,
            difficulty: RecipeDifficulty.hard,
          }),
        }),
      );
      expect(service.getRecipeById).toHaveBeenCalledWith(1, 'it', 1);
      expect(result.total_time).toBe(35);
    });

    it('updates steps, ingredients, and tags when those relations are provided', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        prep_time: 15,
        cook_time: 10,
        source_lang: 'it',
        translations: [],
        steps: [
          {
            id: 10,
            step_number: 1,
            translations: [
              {
                locale: 'it',
                title: 'Vecchio titolo',
                description: 'Vecchia descrizione.',
              },
              {
                locale: 'en',
                title: 'Old title',
                description: 'Old description.',
              },
            ],
          },
        ],
      };
      const updateData = {
        steps: [
          {
            step_number: 1,
            title: 'Nuovo titolo',
            description: 'Nuova descrizione.',
            duration: 20,
          },
          {
            step_number: 2,
            title: 'Secondo titolo',
            description: 'Seconda descrizione.',
          },
        ],
        ingredients: [
          {
            ingredient_id: 2,
            quantity: 100,
            unit: UnitOfMeasure.g,
            notes: 'Tritato',
          },
        ],
        tag_ids: [2, 3],
      };

      jest
        .spyOn(service, 'getRecipeById')
        .mockResolvedValueOnce(existingRecipe as any);
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(existingRecipe);
      mockPrisma.ingredient.findMany.mockResolvedValueOnce([{ id: 2 }]);
      mockPrisma.tag.findMany.mockResolvedValueOnce([{ id: 2 }, { id: 3 }]);
      mockPrisma.recipe.update.mockResolvedValueOnce(existingRecipe);

      await service.updateRecipe(1, 1, updateData);

      expect(mockPrisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            recipe_ingredients: {
              deleteMany: {},
              create: [
                {
                  ingredient_id: 2,
                  quantity: 100,
                  unit: UnitOfMeasure.g,
                  notes: { it: 'Tritato' },
                },
              ],
            },
            recipe_tags: {
              deleteMany: {},
              create: [{ tag_id: 2 }, { tag_id: 3 }],
            },
            steps: {
              deleteMany: {},
              create: [
                {
                  step_number: 1,
                  duration: 20,
                  image_url: null,
                  translations: {
                    create: [
                      {
                        locale: 'en',
                        title: 'Old title',
                        description: 'Old description.',
                      },
                      {
                        locale: 'it',
                        title: 'Nuovo titolo',
                        description: 'Nuova descrizione.',
                      },
                    ],
                  },
                },
                {
                  step_number: 2,
                  duration: null,
                  image_url: null,
                  translations: {
                    create: [
                      {
                        locale: 'it',
                        title: 'Secondo titolo',
                        description: 'Seconda descrizione.',
                      },
                    ],
                  },
                },
              ],
            },
          }),
        }),
      );
    });

    it('preserves existing step image_url and unlinks removed step illustrations when updating steps', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        prep_time: 15,
        cook_time: 10,
        source_lang: 'it',
        translations: [],
        steps: [
          {
            id: 10,
            step_number: 1,
            image_url: '/uploads/recipes/step-1.jpg',
            translations: [
              { locale: 'it', title: 'Passo 1', description: 'Descrizione 1' },
            ],
          },
          {
            id: 11,
            step_number: 2,
            image_url: '/uploads/recipes/step-2.jpg',
            translations: [
              { locale: 'it', title: 'Passo 2', description: 'Descrizione 2' },
            ],
          },
        ],
      };

      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValue(undefined);

      jest
        .spyOn(service, 'getRecipeById')
        .mockResolvedValueOnce(existingRecipe as any);
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(existingRecipe);
      mockPrisma.recipe.update.mockResolvedValueOnce(existingRecipe);

      // Update keeping only step 1 (step 2 is removed)
      await service.updateRecipe(1, 1, {
        steps: [
          {
            step_number: 1,
            description: 'Descrizione aggiornata',
            duration: 15,
          },
        ],
      });

      // Assert step 1 preserved its image_url
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            steps: expect.objectContaining({
              create: [
                expect.objectContaining({
                  step_number: 1,
                  image_url: '/uploads/recipes/step-1.jpg',
                }),
              ],
            }),
          }),
        }),
      );

      // Assert removed step 2 illustration was unlinked from disk
      expect(unlinkSpy).toHaveBeenCalledWith(
        expect.stringContaining('step-2.jpg'),
      );
      unlinkSpy.mockRestore();
    });

    it('updates RecipeTranslation for a specific locale without touching other locales when retranslate is not specified', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        prep_time: 15,
        cook_time: 10,
        total_time: 25,
        servings: 4,
        source_lang: 'it',
        translations: [
          {
            recipe_id: 1,
            locale: 'it',
            title: 'Pasta al Pesto',
            description: 'Descrizione italiana.',
          },
        ],
        steps: [],
      };

      jest
        .spyOn(service, 'getRecipeById')
        .mockResolvedValueOnce(existingRecipe as any);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(existingRecipe);

      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(mockPrisma);
        }
        return cb;
      });

      mockPrisma.recipe.update.mockResolvedValueOnce({
        ...existingRecipe,
      });

      await service.updateRecipe(1, 1, {
        title: 'Nuova Pasta al Pesto',
        locale: 'it',
      });

      expect(mockTranslationService.translateBatch).not.toHaveBeenCalled();
      expect(mockPrisma.recipeTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipe_id_locale: {
              recipe_id: 1,
              locale: 'it',
            },
          },
          update: expect.objectContaining({
            title: 'Nuova Pasta al Pesto',
          }),
        }),
      );
      expect(service.getRecipeById).toHaveBeenCalledWith(1, 'it', 1);
    });

    it('throws BadRequestException when retranslate is true but locale differs from source_lang', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        source_lang: 'it',
        translations: [
          {
            recipe_id: 1,
            locale: 'it',
            title: 'Pasta al Pesto',
            description: 'Descrizione italiana.',
          },
        ],
        steps: [],
      };

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(existingRecipe);

      await expect(
        service.updateRecipe(
          1,
          1,
          {
            title: 'New Pesto Pasta',
            locale: 'en',
          },
          true,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          "Automatic retranslation is only permitted when modifying the recipe in its source language ('it')",
        ),
      );

      expect(mockTranslationService.translateBatch).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('allows updating non-source locale when retranslate is false or omitted', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        source_lang: 'it',
        translations: [
          {
            recipe_id: 1,
            locale: 'it',
            title: 'Pasta al Pesto',
            description: 'Descrizione italiana.',
          },
        ],
        steps: [],
      };

      jest
        .spyOn(service, 'getRecipeById')
        .mockResolvedValueOnce(existingRecipe as any);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(existingRecipe);
      mockPrisma.recipe.update.mockResolvedValueOnce(existingRecipe);

      await expect(
        service.updateRecipe(
          1,
          1,
          {
            title: 'New Pesto Pasta',
            locale: 'en',
          },
          false,
        ),
      ).resolves.toBeDefined();

      expect(mockTranslationService.translateBatch).not.toHaveBeenCalled();
      expect(mockPrisma.recipeTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            recipe_id_locale: {
              recipe_id: 1,
              locale: 'en',
            },
          },
          update: expect.objectContaining({
            title: 'New Pesto Pasta',
          }),
        }),
      );
      expect(service.getRecipeById).toHaveBeenCalledWith(1, 'en', 1);
    });

    it('re-translates source text across remaining locales when retranslate is true and updates translation_status', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        source_lang: 'it',
        prep_time: 15,
        cook_time: 10,
        total_time: 25,
        servings: 4,
        translations: [
          {
            recipe_id: 1,
            locale: 'it',
            title: 'Pasta al Pesto Fresco',
            description: 'Descrizione vecchia.',
            preservation: null,
            tips: null,
          },
        ],
        steps: [
          {
            id: 10,
            recipe_id: 1,
            step_number: 1,
            translations: [
              {
                step_id: 10,
                locale: 'it',
                title: 'Pesta',
                description: 'Pesta il basilico.',
              },
            ],
          },
        ],
      };

      jest
        .spyOn(service, 'getRecipeById')
        .mockResolvedValueOnce(existingRecipe as any);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(existingRecipe);

      mockTranslationService.translateBatch.mockResolvedValue({
        translations: [
          'Fresh Pesto Pasta',
          'New English Description',
          '',
          '',
          'Crush',
          'Crush basil.',
        ],
        success: true,
      });

      mockPrisma.recipe.update.mockResolvedValueOnce({
        ...existingRecipe,
        translation_status: 'completed',
      });

      await service.updateRecipe(
        1,
        1,
        {
          title: 'Pasta al Pesto Fresco',
          description: 'Nuova descrizione ligure.',
          locale: 'it',
        },
        true,
      );

      expect(mockTranslationService.translateBatch).toHaveBeenCalledTimes(2);
      expect(mockPrisma.recipeTranslation.upsert).toHaveBeenCalled();
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ translation_status: 'completed' }),
        }),
      );
      expect(service.getRecipeById).toHaveBeenCalledWith(1, 'it', 1);
    });
  });

  describe('deleteRecipe', () => {
    it('throws NotFoundException when recipe does not exist or user is not author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.deleteRecipe(999, 1)).rejects.toThrow(
        NotFoundException,
      );

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
        steps: [],
        recipe_media: [],
      });

      await expect(service.deleteRecipe(1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes recipe and unlinks all associated media files from disk', async () => {
      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValue(undefined);

      const mockRecipe = {
        id: 1,
        user_id: 1,
        cover_image_url: '/uploads/recipes/cover-1.jpg',
        video_url: '/uploads/recipes/video-1.mp4',
        steps: [
          { image_url: '/uploads/recipes/step-1.jpg' },
          { image_url: null },
        ],
        recipe_media: [{ url: '/uploads/recipes/gallery-1.jpg' }],
      };

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(mockRecipe);
      mockPrisma.recipe.delete.mockResolvedValueOnce({ id: 1 });

      const result = await service.deleteRecipe(1, 1);

      expect(mockPrisma.recipe.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(unlinkSpy).toHaveBeenCalledWith(
        join(RECIPE_UPLOADS_DIR, 'cover-1.jpg'),
      );
      expect(unlinkSpy).toHaveBeenCalledWith(
        join(RECIPE_UPLOADS_DIR, 'video-1.mp4'),
      );
      expect(unlinkSpy).toHaveBeenCalledWith(
        join(RECIPE_UPLOADS_DIR, 'step-1.jpg'),
      );
      expect(unlinkSpy).toHaveBeenCalledWith(
        join(RECIPE_UPLOADS_DIR, 'gallery-1.jpg'),
      );
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          subject: NotificationSubject.recipe,
          target_id: 1,
        },
      });
      expect(result).toEqual({ id: 1 });

      unlinkSpy.mockRestore();
    });
  });

  describe('uploadCoverImage', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'cover.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      size: 1024,
      destination: 'uploads/recipes',
      filename: 'recipe-1-cover.jpg',
      path: 'uploads/recipes/recipe-1-cover.jpg',
      buffer: Buffer.from('test'),
    } as any;

    it('throws NotFoundException when recipe does not exist or user is not author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.uploadCoverImage(999, 1, mockFile)).rejects.toThrow(
        NotFoundException,
      );

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
      });

      await expect(service.uploadCoverImage(1, 1, mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates cover_image_url on recipe and returns URL', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
      });

      mockPrisma.recipe.update.mockResolvedValueOnce({
        id: 1,
        cover_image_url: '/uploads/recipes/recipe-1-cover.jpg',
      });

      const result = await service.uploadCoverImage(1, 1, mockFile);

      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { cover_image_url: '/uploads/recipes/recipe-1-cover.jpg' },
      });
      expect(result).toEqual({
        cover_image_url: '/uploads/recipes/recipe-1-cover.jpg',
      });
    });

    it('should throw BadRequestException if cover image file is missing', async () => {
      await expect(
        service.uploadCoverImage(
          1,
          1,
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should unlink old cover image when uploading a replacement cover image', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        cover_image_url: '/uploads/recipes/old-cover.png',
      };
      (prisma.recipe.findUnique as jest.Mock).mockResolvedValue(existingRecipe);
      (prisma.recipe.update as jest.Mock).mockResolvedValue({
        ...existingRecipe,
        cover_image_url: '/uploads/recipes/new-cover.png',
      });
      const safeUnlinkSpy = jest
        .spyOn(service as any, 'safeUnlink')
        .mockResolvedValue(undefined);

      const mockFile = { filename: 'new-cover.png' } as Express.Multer.File;
      await service.uploadCoverImage(1, 1, mockFile);

      expect(safeUnlinkSpy).toHaveBeenCalledWith(
        '/uploads/recipes/old-cover.png',
      );
    });
  });

  describe('uploadStepImage', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'step-1.jpg',
      filename: 'recipe-1-step-1.jpg',
    } as any;

    it('throws NotFoundException when recipe does not exist or user is not author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.uploadStepImage(999, 1, 1, mockFile),
      ).rejects.toThrow(NotFoundException);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
      });

      await expect(service.uploadStepImage(1, 1, 1, mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when step with stepNumber is not found', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
      });
      mockPrisma.recipeStep.findFirst.mockResolvedValueOnce(null);

      await expect(service.uploadStepImage(1, 5, 1, mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates image_url on target RecipeStep and returns step number and image URL', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
      });
      mockPrisma.recipeStep.findFirst.mockResolvedValueOnce({
        id: 10,
        recipe_id: 1,
        step_number: 1,
      });
      mockPrisma.recipeStep.update.mockResolvedValueOnce({
        id: 10,
        step_number: 1,
        image_url: '/uploads/recipes/recipe-1-step-1.jpg',
      });

      const result = await service.uploadStepImage(1, 1, 1, mockFile);

      expect(mockPrisma.recipeStep.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { image_url: '/uploads/recipes/recipe-1-step-1.jpg' },
      });
      expect(result).toEqual({
        step_number: 1,
        image_url: '/uploads/recipes/recipe-1-step-1.jpg',
      });
    });

    it('should throw BadRequestException if step illustration file is missing', async () => {
      await expect(
        service.uploadStepImage(
          1,
          1,
          1,
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should unlink old step illustration when uploading a replacement step image', async () => {
      const existingRecipe = { id: 1, user_id: 1 };
      const existingStep = {
        id: 10,
        recipe_id: 1,
        step_number: 1,
        image_url: '/uploads/recipes/old-step.png',
      };
      (prisma.recipe.findUnique as jest.Mock).mockResolvedValue(existingRecipe);
      (prisma.recipeStep.findFirst as jest.Mock).mockResolvedValue(
        existingStep,
      );
      (prisma.recipeStep.update as jest.Mock).mockResolvedValue({
        ...existingStep,
        image_url: '/uploads/recipes/new-step.png',
      });
      const safeUnlinkSpy = jest
        .spyOn(service as any, 'safeUnlink')
        .mockResolvedValue(undefined);

      const mockFile = { filename: 'new-step.png' } as Express.Multer.File;
      await service.uploadStepImage(1, 1, 1, mockFile);

      expect(safeUnlinkSpy).toHaveBeenCalledWith(
        '/uploads/recipes/old-step.png',
      );
    });
  });

  describe('uploadGalleryMedia', () => {
    const mockFiles = [
      {
        fieldname: 'files',
        originalname: 'gallery-1.jpg',
        filename: 'recipe-1-gallery-1.jpg',
      },
      {
        fieldname: 'files',
        originalname: 'gallery-2.jpg',
        filename: 'recipe-1-gallery-2.jpg',
      },
    ] as any[];

    it('throws NotFoundException when recipe does not exist or user is not author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.uploadGalleryMedia(999, 1, mockFiles),
      ).rejects.toThrow(NotFoundException);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
      });

      await expect(service.uploadGalleryMedia(1, 1, mockFiles)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when no files provided or total gallery items exceed 3', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValue({
        id: 1,
        user_id: 1,
      });

      await expect(service.uploadGalleryMedia(1, 1, [])).rejects.toThrow(
        BadRequestException,
      );

      mockPrisma.recipeMedia.findMany.mockResolvedValueOnce([
        { id: 1, order: 0 },
        { id: 2, order: 1 },
      ]);

      await expect(service.uploadGalleryMedia(1, 1, mockFiles)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates RecipeMedia records with sequential ordering and returns created media', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
      });

      mockPrisma.recipeMedia.findMany.mockResolvedValueOnce([
        { id: 1, order: 0 },
      ]);

      mockPrisma.recipeMedia.create
        .mockResolvedValueOnce({
          id: 2,
          recipe_id: 1,
          url: '/uploads/recipes/recipe-1-gallery-1.jpg',
          media_type: 'image',
          order: 1,
        })
        .mockResolvedValueOnce({
          id: 3,
          recipe_id: 1,
          url: '/uploads/recipes/recipe-1-gallery-2.jpg',
          media_type: 'image',
          order: 2,
        });

      const result = await service.uploadGalleryMedia(1, 1, mockFiles);

      expect(mockPrisma.recipeMedia.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.recipeMedia.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          recipe_id: 1,
          url: '/uploads/recipes/recipe-1-gallery-1.jpg',
          media_type: 'image',
          order: 1,
        }),
      });
      expect(mockPrisma.recipeMedia.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          recipe_id: 1,
          url: '/uploads/recipes/recipe-1-gallery-2.jpg',
          media_type: 'image',
          order: 2,
        }),
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('uploadVideo', () => {
    const mockFile = {
      fieldname: 'file',
      originalname: 'tutorial.mp4',
      filename: 'recipe-1-video.mp4',
    } as any;

    it('throws NotFoundException when recipe does not exist or user is not author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.uploadVideo(999, 1, mockFile)).rejects.toThrow(
        NotFoundException,
      );

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
      });

      await expect(service.uploadVideo(1, 1, mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates video_url on recipe and returns video URL', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
      });

      mockPrisma.recipe.update.mockResolvedValueOnce({
        id: 1,
        video_url: '/uploads/recipes/recipe-1-video.mp4',
      });

      const result = await service.uploadVideo(1, 1, mockFile);

      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { video_url: '/uploads/recipes/recipe-1-video.mp4' },
      });
      expect(result).toEqual({
        video_url: '/uploads/recipes/recipe-1-video.mp4',
      });
    });

    it('should throw BadRequestException if video file is missing', async () => {
      await expect(
        service.uploadVideo(1, 1, undefined as unknown as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('should unlink old video when uploading a replacement tutorial video', async () => {
      const existingRecipe = {
        id: 1,
        user_id: 1,
        video_url: '/uploads/recipes/old-video.mp4',
      };
      (prisma.recipe.findUnique as jest.Mock).mockResolvedValue(existingRecipe);
      (prisma.recipe.update as jest.Mock).mockResolvedValue({
        ...existingRecipe,
        video_url: '/uploads/recipes/new-video.mp4',
      });
      const safeUnlinkSpy = jest
        .spyOn(service as any, 'safeUnlink')
        .mockResolvedValue(undefined);

      const mockFile = { filename: 'new-video.mp4' } as Express.Multer.File;
      await service.uploadVideo(1, 1, mockFile);

      expect(safeUnlinkSpy).toHaveBeenCalledWith(
        '/uploads/recipes/old-video.mp4',
      );
    });
  });

  describe('deleteCoverImage', () => {
    it('deletes cover image file and nullifies cover_image_url', async () => {
      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValue(undefined);
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        cover_image_url: '/uploads/recipes/cover-1.jpg',
      });
      mockPrisma.recipe.update.mockResolvedValueOnce({
        id: 1,
        cover_image_url: null,
      });

      const res = await service.deleteCoverImage(1, 1);

      expect(unlinkSpy).toHaveBeenCalledWith(
        join(RECIPE_UPLOADS_DIR, 'cover-1.jpg'),
      );
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { cover_image_url: null },
      });
      expect(res).toEqual({ message: 'Cover image deleted successfully' });
      unlinkSpy.mockRestore();
    });
  });

  describe('deleteVideo', () => {
    it('deletes video file and nullifies video_url', async () => {
      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValue(undefined);
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
        video_url: '/uploads/recipes/video-1.mp4',
      });
      mockPrisma.recipe.update.mockResolvedValueOnce({
        id: 1,
        video_url: null,
      });

      const res = await service.deleteVideo(1, 1);

      expect(unlinkSpy).toHaveBeenCalledWith(
        join(RECIPE_UPLOADS_DIR, 'video-1.mp4'),
      );
      expect(mockPrisma.recipe.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { video_url: null },
      });
      expect(res).toEqual({ message: 'Recipe video deleted successfully' });
      unlinkSpy.mockRestore();
    });
  });

  describe('deleteStepImage', () => {
    it('deletes step image file and nullifies step image_url', async () => {
      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValue(undefined);
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
      });
      mockPrisma.recipeStep.findFirst.mockResolvedValueOnce({
        id: 10,
        recipe_id: 1,
        step_number: 1,
        image_url: '/uploads/recipes/step-1.jpg',
      });
      mockPrisma.recipeStep.update.mockResolvedValueOnce({
        id: 10,
        image_url: null,
      });

      const res = await service.deleteStepImage(1, 1, 1);

      expect(unlinkSpy).toHaveBeenCalledWith(
        join(RECIPE_UPLOADS_DIR, 'step-1.jpg'),
      );
      expect(mockPrisma.recipeStep.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { image_url: null },
      });
      expect(res).toEqual({ message: 'Step image deleted successfully' });
      unlinkSpy.mockRestore();
    });
  });

  describe('deleteGalleryMedia', () => {
    it('deletes gallery image file and deletes RecipeMedia record', async () => {
      const unlinkSpy = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValue(undefined);
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 1,
      });
      mockPrisma.recipeMedia.findFirst.mockResolvedValueOnce({
        id: 5,
        recipe_id: 1,
        url: '/uploads/recipes/gallery-1.jpg',
      });
      mockPrisma.recipeMedia.delete.mockResolvedValueOnce({ id: 5 });

      const res = await service.deleteGalleryMedia(1, 5, 1);

      expect(unlinkSpy).toHaveBeenCalledWith(
        join(RECIPE_UPLOADS_DIR, 'gallery-1.jpg'),
      );
      expect(mockPrisma.recipeMedia.delete).toHaveBeenCalledWith({
        where: { id: 5 },
      });
      expect(res).toEqual({ message: 'Gallery media deleted successfully' });
      unlinkSpy.mockRestore();
    });
  });

  describe('likeRecipe', () => {
    it('throws NotFoundException if recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.likeRecipe(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates like atomically and dispatches notification to recipe author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 2,
      });
      mockPrisma.like.create.mockResolvedValueOnce({
        user_id: 1,
        recipe_id: 10,
      });

      const res = await service.likeRecipe(10, 1);

      expect(mockPrisma.like.create).toHaveBeenCalledWith({
        data: { user_id: 1, recipe_id: 10 },
      });
      expect(mockNotificationEmit.notification).toHaveBeenCalledWith(
        { id_user: 1, id_target: 10 },
        { subject: NotificationSubject.recipe, action: NotificationAction.like },
      );
      expect(res).toEqual({
        message: 'Recipe liked successfully',
        liked: true,
      });
    });

    it('suppresses notification when author likes own recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 1,
      });
      mockPrisma.like.create.mockResolvedValueOnce({
        user_id: 1,
        recipe_id: 10,
      });

      const res = await service.likeRecipe(10, 1);

      expect(mockPrisma.like.create).toHaveBeenCalledWith({
        data: { user_id: 1, recipe_id: 10 },
      });
      expect(mockNotificationEmit.notification).not.toHaveBeenCalled();
      expect(res).toEqual({
        message: 'Recipe liked successfully',
        liked: true,
      });
    });

    it('handles concurrent duplicate like (P2002) idempotently without duplicate notification', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 2,
      });
      mockPrisma.like.create.mockRejectedValueOnce({ code: 'P2002' });

      const res = await service.likeRecipe(10, 1);

      expect(mockNotificationEmit.notification).not.toHaveBeenCalled();
      expect(res).toEqual({
        message: 'Recipe liked successfully',
        liked: true,
      });
    });

    it('rethrows unexpected prisma errors during like', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 10,
        user_id: 2,
      });
      mockPrisma.like.create.mockRejectedValueOnce(
        new Error('Database unavailable'),
      );

      await expect(service.likeRecipe(10, 1)).rejects.toThrow(
        'Database unavailable',
      );
    });
  });

  describe('unlikeRecipe', () => {
    it('throws NotFoundException if recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.unlikeRecipe(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes like atomically and prunes unread notifications', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 10, user_id: 2 });
      mockPrisma.like.delete.mockResolvedValueOnce({
        user_id: 1,
        recipe_id: 10,
      });
      mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 1 });

      const res = await service.unlikeRecipe(10, 1);

      expect(mockPrisma.like.delete).toHaveBeenCalledWith({
        where: {
          user_id_recipe_id: { user_id: 1, recipe_id: 10 },
        },
      });
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          user_id: 2,
          actor_id: 1,
          subject: NotificationSubject.recipe,
          action: NotificationAction.like,
          target_id: 10,
          is_read: false,
        },
      });
      expect(res).toEqual({
        message: 'Recipe unliked successfully',
        liked: false,
      });
    });

    it('deletes like but skips notification pruning when unliked by recipe author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 10, user_id: 1 });
      mockPrisma.like.delete.mockResolvedValueOnce({
        user_id: 1,
        recipe_id: 10,
      });

      const res = await service.unlikeRecipe(10, 1);

      expect(mockPrisma.like.delete).toHaveBeenCalledWith({
        where: {
          user_id_recipe_id: { user_id: 1, recipe_id: 10 },
        },
      });
      expect(mockPrisma.notification.deleteMany).not.toHaveBeenCalled();
      expect(res).toEqual({
        message: 'Recipe unliked successfully',
        liked: false,
      });
    });

    it('handles concurrent missing like (P2025) idempotently', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 10, user_id: 2 });
      mockPrisma.like.delete.mockRejectedValueOnce({ code: 'P2025' });
      mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 0 });

      const res = await service.unlikeRecipe(10, 1);

      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          user_id: 2,
          actor_id: 1,
          subject: NotificationSubject.recipe,
          action: NotificationAction.like,
          target_id: 10,
          is_read: false,
        },
      });
      expect(res).toEqual({
        message: 'Recipe unliked successfully',
        liked: false,
      });
    });

    it('rethrows unexpected prisma errors during unlike', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 10, user_id: 2 });
      mockPrisma.like.delete.mockRejectedValueOnce(
        new Error('Connection failure'),
      );

      await expect(service.unlikeRecipe(10, 1)).rejects.toThrow(
        'Connection failure',
      );
    });
  });

  describe('createComment', () => {
    const commentDto: CreateCommentDto = {
      content: 'Ottima ricetta!',
    };

    it('throws NotFoundException when recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.createComment(999, 1, commentDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when parent_id does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.createComment(1, 1, { ...commentDto, parent_id: 888 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when parent comment belongs to a different recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 2,
        parent_id: null,
      });

      await expect(
        service.createComment(1, 1, { ...commentDto, parent_id: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a root comment and dispatches notification to recipe author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1, user_id: 2 });
      const createdComment = {
        id: 100,
        recipe_id: 1,
        user_id: 5,
        parent_id: null,
        content: 'Ottima ricetta!',
        is_active: true,
        created_at: new Date('2026-10-13T10:00:00Z'),
        user: {
          id: 5,
          username: 'mario',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      };
      mockPrisma.comment.create.mockResolvedValueOnce(createdComment);

      const result = await service.createComment(1, 5, commentDto);

      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: {
          recipe_id: 1,
          user_id: 5,
          content: 'Ottima ricetta!',
          parent_id: null,
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
      expect(mockNotificationEmit.notification).toHaveBeenCalledWith(
        { id_user: 5, id_target: 1 },
        { subject: NotificationSubject.recipe, action: NotificationAction.comment },
      );
      expect(result).toEqual(createdComment);
    });

    it('creates a root comment by recipe author and suppresses notification', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1, user_id: 5 });
      const createdComment = {
        id: 100,
        recipe_id: 1,
        user_id: 5,
        parent_id: null,
        content: 'Ottima ricetta!',
        is_active: true,
        created_at: new Date('2026-10-13T10:00:00Z'),
        user: {
          id: 5,
          username: 'mario',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      };
      mockPrisma.comment.create.mockResolvedValueOnce(createdComment);

      const result = await service.createComment(1, 5, commentDto);

      expect(mockNotificationEmit.notification).not.toHaveBeenCalled();
      expect(result).toEqual(createdComment);
    });

    it('creates a reply, normalizes hierarchy, and strictly notifies parent comment author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1, user_id: 2 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 20,
        recipe_id: 1,
        parent_id: 10,
        user_id: 8,
      });

      const createdReply = {
        id: 30,
        recipe_id: 1,
        user_id: 7,
        parent_id: 10,
        content: 'Concordo!',
        is_active: true,
        created_at: new Date('2026-10-13T10:05:00Z'),
        user: {
          id: 7,
          username: 'luigi',
          avatar_url: null,
        },
      };
      mockPrisma.comment.create.mockResolvedValueOnce(createdReply);

      const result = await service.createComment(1, 7, {
        content: 'Concordo!',
        parent_id: 20,
      });

      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: {
          recipe_id: 1,
          user_id: 7,
          content: 'Concordo!',
          parent_id: 10,
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
      expect(mockNotificationEmit.notification).toHaveBeenCalledTimes(1);
      expect(mockNotificationEmit.notification).toHaveBeenCalledWith(
        { id_user: 7, id_target: 20 },
        { subject: NotificationSubject.comment, action: NotificationAction.comment },
      );
      expect(result).toEqual(createdReply);
    });

    it('creates a reply to own comment and suppresses notification', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1, user_id: 2 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 20,
        recipe_id: 1,
        parent_id: null,
        user_id: 7,
      });

      const createdReply = {
        id: 30,
        recipe_id: 1,
        user_id: 7,
        parent_id: 20,
        content: 'Aggiungo un dettaglio',
        is_active: true,
        created_at: new Date('2026-10-13T10:05:00Z'),
        user: {
          id: 7,
          username: 'luigi',
          avatar_url: null,
        },
      };
      mockPrisma.comment.create.mockResolvedValueOnce(createdReply);

      const result = await service.createComment(1, 7, {
        content: 'Aggiungo un dettaglio',
        parent_id: 20,
      });

      expect(mockNotificationEmit.notification).not.toHaveBeenCalled();
      expect(result).toEqual(createdReply);
    });

    it('creates a root comment when parent_id is omitted', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });
      const createdComment = {
        id: 100,
        recipe_id: 1,
        user_id: 5,
        parent_id: null,
        content: 'Ottima ricetta!',
        is_active: true,
        created_at: new Date('2026-10-13T10:00:00Z'),
        user: {
          id: 5,
          username: 'mario',
          avatar_url: 'https://example.com/avatar.jpg',
        },
      };
      mockPrisma.comment.create.mockResolvedValueOnce(createdComment);

      const result = await service.createComment(1, 5, commentDto);

      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: {
          recipe_id: 1,
          user_id: 5,
          content: 'Ottima ricetta!',
          parent_id: null,
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
      expect(result).toEqual(createdComment);
    });

    it('creates a reply and normalizes reply-to-reply when parent comment is already a reply', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 20,
        recipe_id: 1,
        parent_id: 10,
      });

      const createdReply = {
        id: 30,
        recipe_id: 1,
        user_id: 7,
        parent_id: 10,
        content: 'Concordo!',
        is_active: true,
        created_at: new Date('2026-10-13T10:05:00Z'),
        user: {
          id: 7,
          username: 'luigi',
          avatar_url: null,
        },
      };
      mockPrisma.comment.create.mockResolvedValueOnce(createdReply);

      const result = await service.createComment(1, 7, {
        content: 'Concordo!',
        parent_id: 20,
      });

      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: {
          recipe_id: 1,
          user_id: 7,
          content: 'Concordo!',
          parent_id: 10,
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
      expect(result).toEqual(createdReply);
    });
  });

  describe('getComments', () => {
    it('throws NotFoundException when recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.getComments(999)).rejects.toThrow(NotFoundException);
    });

    it('returns threaded comments, preserving intermediate deactivated replies and dropping trailing deactivated replies', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });

      const mockCommentsFromDb = [
        // Root 1: Active, with 4 replies (active, inactive-intermediate, active, inactive-trailing)
        {
          id: 1,
          recipe_id: 1,
          user_id: 10,
          parent_id: null,
          content: 'Parent comment 1',
          is_active: true,
          created_at: new Date('2026-10-13T10:00:00Z'),
          user: { id: 10, username: 'marco', avatar_url: null },
          replies: [
            {
              id: 2,
              recipe_id: 1,
              user_id: 20,
              parent_id: 1,
              content: 'Reply 1 (active)',
              is_active: true,
              is_edited: false,
              created_at: new Date('2026-10-13T10:01:00Z'),
              updated_at: null,
              user: { id: 20, username: 'lara', avatar_url: null },
            },
            {
              id: 3,
              recipe_id: 1,
              user_id: 30,
              parent_id: 1,
              content: 'Reply 2 (inactive - intermediate)',
              is_active: false,
              is_edited: false,
              created_at: new Date('2026-10-13T10:02:00Z'),
              updated_at: null,
              user: { id: 30, username: 'giovanni', avatar_url: null },
            },
            {
              id: 4,
              recipe_id: 1,
              user_id: 40,
              parent_id: 1,
              content: 'Reply 3 (active)',
              is_active: true,
              is_edited: false,
              created_at: new Date('2026-10-13T10:03:00Z'),
              updated_at: null,
              user: { id: 40, username: 'anna', avatar_url: null },
            },
            {
              id: 5,
              recipe_id: 1,
              user_id: 50,
              parent_id: 1,
              content: 'Reply 4 (inactive - trailing)',
              is_active: false,
              is_edited: false,
              created_at: new Date('2026-10-13T10:04:00Z'),
              updated_at: null,
              user: { id: 50, username: 'paolo', avatar_url: null },
            },
          ],
        },
        // Root 2: Inactive, with only trailing inactive replies -> omitted completely
        {
          id: 6,
          recipe_id: 1,
          user_id: 60,
          parent_id: null,
          content: 'Parent comment 2 (inactive)',
          is_active: false,
          is_edited: false,
          created_at: new Date('2026-10-13T10:05:00Z'),
          updated_at: null,
          user: { id: 60, username: 'luca', avatar_url: null },
          replies: [
            {
              id: 7,
              recipe_id: 1,
              user_id: 70,
              parent_id: 6,
              content: 'Reply (inactive)',
              is_active: false,
              is_edited: false,
              created_at: new Date('2026-10-13T10:06:00Z'),
              updated_at: null,
              user: { id: 70, username: 'sara', avatar_url: null },
            },
          ],
        },
        // Root 3: Inactive, but has active replies -> kept redacted
        {
          id: 8,
          recipe_id: 1,
          user_id: 80,
          parent_id: null,
          content: 'Parent comment 3 (inactive with active reply)',
          is_active: false,
          is_edited: false,
          created_at: new Date('2026-10-13T10:07:00Z'),
          updated_at: null,
          user: { id: 80, username: 'elena', avatar_url: null },
          replies: [
            {
              id: 9,
              recipe_id: 1,
              user_id: 90,
              parent_id: 8,
              content: 'Reply to deleted root (active)',
              is_active: true,
              is_edited: false,
              created_at: new Date('2026-10-13T10:08:00Z'),
              updated_at: null,
              user: { id: 90, username: 'matteo', avatar_url: null },
            },
          ],
        },
        // Root 4: Active with no replies
        {
          id: 10,
          recipe_id: 1,
          user_id: 100,
          parent_id: null,
          content: 'Parent comment 4 (active, no replies)',
          is_active: true,
          is_edited: false,
          created_at: new Date('2026-10-13T10:09:00Z'),
          updated_at: null,
          user: { id: 100, username: 'chiara', avatar_url: null },
          replies: [],
        },
      ];

      mockPrisma.comment.findMany.mockResolvedValueOnce(mockCommentsFromDb);

      const result = await service.getComments(1);

      expect(mockPrisma.recipe.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true },
      });

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith({
        where: { recipe_id: 1, parent_id: null },
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

      // Assertions on result: Root 2 must be excluded!
      expect(result).toHaveLength(3);

      // Root 1
      expect(result[0].id).toBe(1);
      expect(result[0].content).toBe('Parent comment 1');
      expect(result[0].is_active).toBe(true);
      expect(result[0].replies).toHaveLength(3);
      expect(result[0].replies[0]).toEqual(mockCommentsFromDb[0].replies[0]);
      // Intermediate inactive reply is redacted
      expect(result[0].replies[1]).toEqual({
        id: 3,
        recipe_id: 1,
        user_id: null,
        parent_id: 1,
        content: null,
        is_active: false,
        is_edited: false,
        created_at: new Date('2026-10-13T10:02:00Z'),
        updated_at: null,
        user: null,
      });
      // 3rd reply is active
      expect(result[0].replies[2]).toEqual(mockCommentsFromDb[0].replies[2]);

      // Root 3 (was inactive, but has active reply, so kept redacted)
      expect(result[1].id).toBe(8);
      expect(result[1].content).toBeNull();
      expect(result[1].user).toBeNull();
      expect(result[1].user_id).toBeNull();
      expect(result[1].is_active).toBe(false);
      expect(result[1].replies).toHaveLength(1);
      expect(result[1].replies[0]).toEqual(mockCommentsFromDb[2].replies[0]);

      // Root 4 (active with no replies)
      expect(result[2].id).toBe(10);
      expect(result[2].content).toBe('Parent comment 4 (active, no replies)');
      expect(result[2].replies).toEqual([]);
    });
  });

  describe('deleteComment', () => {
    it('throws NotFoundException when recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(service.deleteComment(999, 10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when comment does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 100,
      });
      mockPrisma.comment.findUnique.mockResolvedValueOnce(null);

      await expect(service.deleteComment(1, 888, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when comment belongs to a different recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 100,
      });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 2,
        user_id: 1,
      });

      await expect(service.deleteComment(1, 10, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when user is neither comment author nor recipe author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 100,
      });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 1,
        user_id: 50,
      });

      await expect(service.deleteComment(1, 10, 99)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deactivates comment when user is the comment author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 100,
      });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 1,
        user_id: 50,
      });
      mockPrisma.comment.update.mockResolvedValueOnce({
        id: 10,
        is_active: false,
      });
      mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 1 });

      const result = await service.deleteComment(1, 10, 50);

      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { is_active: false },
      });
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          subject: NotificationSubject.comment,
          target_id: 10,
          is_read: false,
        },
      });
      expect(result).toEqual({ message: 'Comment deactivated successfully' });
    });

    it('deactivates comment when user is the recipe author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 100,
      });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 1,
        user_id: 50,
      });
      mockPrisma.comment.update.mockResolvedValueOnce({
        id: 10,
        is_active: false,
      });
      mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 0 });

      const result = await service.deleteComment(1, 10, 100);

      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { is_active: false },
      });
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          subject: NotificationSubject.comment,
          target_id: 10,
          is_read: false,
        },
      });
      expect(result).toEqual({ message: 'Comment deactivated successfully' });
    });
  });

  describe('updateComment', () => {
    it('throws NotFoundException when recipe does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateComment(999, 10, 1, { content: 'Updated content' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when comment does not exist', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.updateComment(1, 888, 1, { content: 'Updated content' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when comment belongs to a different recipe', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 2,
        user_id: 1,
        is_active: true,
      });

      await expect(
        service.updateComment(1, 10, 1, { content: 'Updated content' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when comment is deactivated', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 1,
        user_id: 1,
        is_active: false,
      });

      await expect(
        service.updateComment(1, 10, 1, { content: 'Updated content' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when user is not the comment author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 100,
      });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 1,
        user_id: 50,
        is_active: true,
      });

      await expect(
        service.updateComment(1, 10, 99, { content: 'Updated content' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates comment content, sets is_edited: true, and returns updated comment with user when user is author', async () => {
      mockPrisma.recipe.findUnique.mockResolvedValueOnce({ id: 1 });
      mockPrisma.comment.findUnique.mockResolvedValueOnce({
        id: 10,
        recipe_id: 1,
        user_id: 50,
        is_active: true,
        content: 'Original content',
      });

      const updatedComment = {
        id: 10,
        recipe_id: 1,
        user_id: 50,
        parent_id: null,
        content: 'Updated content',
        is_active: true,
        is_edited: true,
        created_at: new Date('2026-10-14T10:00:00Z'),
        updated_at: new Date('2026-10-15T11:00:00Z'),
        user: {
          id: 50,
          username: 'chef_mario',
          avatar_url: '/uploads/avatars/chef_mario.webp',
        },
      };

      mockPrisma.comment.update.mockResolvedValueOnce(updatedComment);

      const result = await service.updateComment(1, 10, 50, {
        content: 'Updated content',
      });

      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: {
          content: 'Updated content',
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
      expect(result).toEqual(updatedComment);
    });
  });
});
