import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Course, RecipeDifficulty, UnitOfMeasure, IngredientCategory } from '@prisma/client';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: {
            ingredient: {
              findMany: jest.fn(),
            },
            tag: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getMeta', () => {
    it('should return all available static options and enums', () => {
      const meta = service.getMeta();

      expect(meta).toHaveProperty('courses', Object.values(Course));
      expect(meta).toHaveProperty('difficulties', Object.values(RecipeDifficulty));
      expect(meta).toHaveProperty('units', Object.values(UnitOfMeasure));
      expect(meta).toHaveProperty('categories', Object.values(IngredientCategory));
    });
  });

  describe('getTags', () => {
    const mockDbTags = [
      {
        id: 1,
        slug: 'vegetarian',
        translations: [
          { locale: 'it', name: 'Vegetariano' },
          { locale: 'en', name: 'Vegetarian' },
          { locale: 'fr', name: 'Végétarien' },
        ],
      },
      {
        id: 2,
        slug: 'quick_easy',
        translations: [
          { locale: 'it', name: 'Veloce e Facile' },
          { locale: 'en', name: 'Quick & Easy' },
          { locale: 'fr', name: 'Rapide et Facile' },
        ],
      },
    ];

    it('should return tags localized in Italian when lang=it', async () => {
      (prisma.tag.findMany as jest.Mock).mockResolvedValue(mockDbTags);

      const result = await service.getTags({ lang: 'it' });

      expect(result).toEqual([
        { id: 1, slug: 'vegetarian', name: 'Vegetariano' },
        { id: 2, slug: 'quick_easy', name: 'Veloce e Facile' },
      ]);
    });

    it('should default to English when lang is not provided or unsupported', async () => {
      (prisma.tag.findMany as jest.Mock).mockResolvedValue(mockDbTags);

      const result = await service.getTags({});

      expect(result).toEqual([
        { id: 1, slug: 'vegetarian', name: 'Vegetarian' },
        { id: 2, slug: 'quick_easy', name: 'Quick & Easy' },
      ]);
    });

    it('should fall back to English if requested locale translation is missing', async () => {
      const tagWithOnlyEnglish = [
        {
          id: 3,
          slug: 'comfort_food',
          translations: [{ locale: 'en', name: 'Comfort Food' }],
        },
      ];
      (prisma.tag.findMany as jest.Mock).mockResolvedValue(tagWithOnlyEnglish);

      const result = await service.getTags({ lang: 'it' });

      expect(result).toEqual([
        { id: 3, slug: 'comfort_food', name: 'Comfort Food' },
      ]);
    });
  });

  describe('getIngredients', () => {
    const mockDbIngredients = [
      {
        id: 1,
        slug: 'tomato',
        category: IngredientCategory.produce,
        translations: [
          { locale: 'it', name: 'Pomodoro' },
          { locale: 'en', name: 'Tomato' },
          { locale: 'fr', name: 'Tomate' },
        ],
      },
      {
        id: 2,
        slug: 'parmesan',
        category: IngredientCategory.dairy_eggs,
        translations: [
          { locale: 'it', name: 'Parmigiano Reggiano' },
          { locale: 'en', name: 'Parmesan' },
          { locale: 'fr', name: 'Parmesan' },
        ],
      },
    ];

    it('should return ingredients localized in the requested language', async () => {
      (prisma.ingredient.findMany as jest.Mock).mockResolvedValue(mockDbIngredients);

      const result = await service.getIngredients({ lang: 'it' });

      expect(result).toEqual([
        { id: 1, slug: 'tomato', category: IngredientCategory.produce, name: 'Pomodoro' },
        { id: 2, slug: 'parmesan', category: IngredientCategory.dairy_eggs, name: 'Parmigiano Reggiano' },
      ]);
    });

    it('should filter by category and search term in relational translations', async () => {
      (prisma.ingredient.findMany as jest.Mock).mockResolvedValue([mockDbIngredients[0]]);

      const result = await service.getIngredients({
        lang: 'it',
        category: IngredientCategory.produce,
        search: 'pomo',
      });

      expect(result).toEqual([
        { id: 1, slug: 'tomato', category: IngredientCategory.produce, name: 'Pomodoro' },
      ]);
      expect(prisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: IngredientCategory.produce,
            OR: expect.arrayContaining([
              { slug: { contains: 'pomo', mode: 'insensitive' } },
              {
                translations: {
                  some: {
                    name: { contains: 'pomo', mode: 'insensitive' },
                  },
                },
              },
            ]),
          }),
        }),
      );
    });
  });
});
