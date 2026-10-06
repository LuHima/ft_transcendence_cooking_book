import { BadRequestException } from '@nestjs/common';
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
});
