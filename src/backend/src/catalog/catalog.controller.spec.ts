import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { IngredientCategory } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('CatalogController', () => {
  let controller: CatalogController;
  let service: CatalogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: {
            getTags: jest.fn().mockResolvedValue([
              { id: 1, slug: 'vegetarian', name: 'Vegetariano', resolved_lang: 'it' },
            ]),
            getIngredients: jest.fn().mockResolvedValue([
              {
                id: 1,
                slug: 'tomato',
                category: IngredientCategory.produce,
                name: 'Pomodoro',
                resolved_lang: 'it',
              },
            ]),
            getTagById: jest.fn().mockResolvedValue({
              id: 5,
              slug: 'gluten_free',
              name: 'Senza glutine',
              resolved_lang: 'it',
            }),
            getIngredientById: jest.fn().mockResolvedValue({
              id: 9,
              slug: 'bell_pepper',
              category: IngredientCategory.produce,
              name: 'Peperone',
              resolved_lang: 'it',
            }),
          },
        },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    service = module.get<CatalogService>(CatalogService);
  });

  describe('getTags', () => {
    it('should delegate to service.getTags with lang parameter', async () => {
      const result = await controller.getTags({ lang: 'it' });

      expect(result).toEqual([
        { id: 1, slug: 'vegetarian', name: 'Vegetariano', resolved_lang: 'it' },
      ]);
      expect(service.getTags).toHaveBeenCalledWith({ lang: 'it' });
    });
  });

  describe('getIngredients', () => {
    it('should delegate to service.getIngredients with query parameters', async () => {
      const result = await controller.getIngredients({
        lang: 'it',
        category: IngredientCategory.produce,
        search: 'pomo',
      });

      expect(result).toEqual([
        {
          id: 1,
          slug: 'tomato',
          category: IngredientCategory.produce,
          name: 'Pomodoro',
          resolved_lang: 'it',
        },
      ]);
      expect(service.getIngredients).toHaveBeenCalledWith({
        lang: 'it',
        category: IngredientCategory.produce,
        search: 'pomo',
      });
    });
  });

  describe('getTagById', () => {
    it('delegates to service.getTagById with numeric id and locale parameter', async () => {
      const result = await controller.getTagById(5, { lang: 'it' });

      expect(service.getTagById).toHaveBeenCalledWith(5, { lang: 'it' });
      expect(result).toEqual({
        id: 5,
        slug: 'gluten_free',
        name: 'Senza glutine',
        resolved_lang: 'it',
      });
    });
  });

  describe('getIngredientById', () => {
    it('delegates to service.getIngredientById with numeric id and locale parameter', async () => {
      const result = await controller.getIngredientById(9, { lang: 'it' });

      expect(service.getIngredientById).toHaveBeenCalledWith(9, { lang: 'it' });
      expect(result).toEqual({
        id: 9,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        name: 'Peperone',
        resolved_lang: 'it',
      });
    });
  });
});
