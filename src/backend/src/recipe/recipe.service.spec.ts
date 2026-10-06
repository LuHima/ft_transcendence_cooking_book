import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Course, RecipeDifficulty, UnitOfMeasure } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TranslationService } from '../translation/translation.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { RecipeService } from './recipe.service';

describe('RecipeService', () => {
  let service: RecipeService;
  let prisma: PrismaService;
  let translationService: TranslationService;

  const mockPrisma = {
    $transaction: jest.fn(),
    recipe: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    recipeTranslation: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    recipeStepTranslation: {
      upsert: jest.fn(),
      update: jest.fn(),
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
      ],
    }).compile();

    service = module.get<RecipeService>(RecipeService);
    prisma = module.get<PrismaService>(PrismaService);
    translationService = module.get<TranslationService>(TranslationService);

    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb: any) => {
      if (typeof cb === 'function') {
        return cb(mockPrisma);
      }
      return cb;
    });
  });

  describe('createRecipe', () => {
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
      expect(result).toEqual(mockCreatedRecipe);
    });

    it('gracefully falls back to source text with failed translation_status when translation fails', async () => {
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
              create: expect.arrayContaining([
                expect.objectContaining({
                  locale: 'en',
                  title: sampleDto.title,
                }),
                expect.objectContaining({
                  locale: 'fr',
                  title: sampleDto.title,
                }),
              ]),
            },
          }),
        }),
      );
      expect(result).toEqual(mockFailedRecipe);
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
              { locale: 'it', title: 'Cuocere', description: 'Cuoci la pasta.' },
              { locale: 'en', title: 'Cook', description: 'Cook pasta.' },
            ],
          },
          {
            id: 101,
            step_number: 1,
            duration: 5,
            image_url: null,
            translations: [
              { locale: 'it', title: 'Rosolare', description: 'Rosola il guanciale.' },
              { locale: 'en', title: 'Brown', description: 'Brown guanciale.' },
            ],
          },
        ],
        recipe_ingredients: [
          {
            ingredient_id: 5,
            quantity: 150,
            unit: UnitOfMeasure.g,
            notes: { it: 'a listarelle', en: 'sliced strips', fr: 'en lanières' },
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
              { locale: 'it', title: 'Preparare la crema', description: 'Montare uova e mascarpone.' },
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
              translations: [
                { locale: 'it', name: 'Mascarpone' },
              ],
            },
          },
        ],
        recipe_tags: [
          {
            tag: {
              id: 2,
              slug: 'vegetarian',
              translations: [
                { locale: 'it', name: 'Vegetariano' },
              ],
            },
          },
        ],
        recipe_media: [],
      };

      mockPrisma.recipe.findUnique.mockResolvedValueOnce(mockItalianOnlyRecipe);

      const result = await service.getRecipeById(2, 'fr');

      expect(result.id).toBe(2);
      expect(result.title).toBe('Tiramisù Tradizionale');
      expect(result.description).toBe('Il classico tiramisù veneto con savoiardi.');
      expect(result.preservation).toBe('2 giorni in frigo.');
      expect(result.tips).toBe('Usa caffè freddo.');

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].title).toBe('Preparare la crema');
      expect(result.steps[0].description).toBe('Montare uova e mascarpone.');

      expect(result.ingredients[0].name).toBe('Mascarpone');
      expect(result.ingredients[0].notes).toBe('fresco e cremoso');

      expect(result.tags[0].name).toBe('Vegetariano');
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
      ).rejects.toThrow(NotFoundException);

      mockPrisma.recipe.findUnique.mockResolvedValueOnce({
        id: 1,
        user_id: 2,
      });

      await expect(
        service.updateRecipe(1, 1, { servings: 4 }),
      ).rejects.toThrow(NotFoundException);
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
      expect(result.total_time).toBe(35);
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
    });
  });
});
