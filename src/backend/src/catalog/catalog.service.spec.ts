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
      { id: 1, slug: 'vegetarian', name_it: 'Vegetariano', name_en: 'Vegetarian', name_fr: 'Végétarien' },
      { id: 2, slug: 'quick_easy', name_it: 'Veloce e Facile', name_en: 'Quick & Easy', name_fr: 'Rapide et Facile' },
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
  });

  describe('getIngredients', () => {
    const mockDbIngredients = [
      {
        id: 1,
        slug: 'tomato',
        category: IngredientCategory.produce,
        name_it: 'Pomodoro',
        name_en: 'Tomato',
        name_fr: 'Tomate',
      },
      {
        id: 2,
        slug: 'parmesan',
        category: IngredientCategory.dairy_eggs,
        name_it: 'Parmigiano Reggiano',
        name_en: 'Parmesan',
        name_fr: 'Parmesan',
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

    it('should filter by category and search term in prisma query', async () => {
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
          }),
        }),
      );
    });
  });
});
