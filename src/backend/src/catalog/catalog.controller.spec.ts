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
            getTags: jest.fn().mockResolvedValue({
              items: [
                {
                  id: 1,
                  slug: 'vegetarian',
                  name: 'Vegetariano',
                  resolved_lang: 'it',
                },
              ],
              total: 1,
              page: 1,
              limit: 20,
              total_pages: 1,
              has_next_page: false,
              has_prev_page: false,
            }),
            getIngredients: jest.fn().mockResolvedValue({
              items: [
                {
                  id: 1,
                  slug: 'tomato',
                  category: IngredientCategory.produce,
                  name: 'Pomodoro',
                  resolved_lang: 'it',
                },
              ],
              total: 1,
              page: 1,
              limit: 20,
              total_pages: 1,
              has_next_page: false,
              has_prev_page: false,
            }),
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
    it('should delegate to service.getTags with FilterTagDto parameters', async () => {
      const query = { page: 1, limit: 20, lang: 'it' as const, search: 'veg' };
      const result = await controller.getTags(query);

      expect(result.items).toEqual([
        { id: 1, slug: 'vegetarian', name: 'Vegetariano', resolved_lang: 'it' },
      ]);
      expect(result.total).toBe(1);
      expect(service.getTags).toHaveBeenCalledWith(query);
    });
  });

  describe('getIngredients', () => {
    it('should delegate to service.getIngredients with query parameters', async () => {
      const query = {
        page: 1,
        limit: 20,
        lang: 'it' as const,
        category: IngredientCategory.produce,
        search: 'pomo',
      };
      const result = await controller.getIngredients(query);

      expect(result.items).toEqual([
        {
          id: 1,
          slug: 'tomato',
          category: IngredientCategory.produce,
          name: 'Pomodoro',
          resolved_lang: 'it',
        },
      ]);
      expect(result.total).toBe(1);
      expect(service.getIngredients).toHaveBeenCalledWith(query);
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
