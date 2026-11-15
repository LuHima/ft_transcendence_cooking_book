import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { IngredientCategory } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { SortOrder } from '../common/dto/sort-order.enum';

describe('CatalogController', () => {
  let controller: CatalogController;
  let mockCatalogService: {
    getTags: jest.Mock;
    getIngredients: jest.Mock;
    getTagById: jest.Mock;
    getIngredientById: jest.Mock;
  };

  beforeEach(async () => {
    mockCatalogService = {
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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: mockCatalogService,
        },
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
  });

  describe('getTags', () => {
    it('should delegate to service.getTags with FilterTagDto parameters', async () => {
      const query = { page: 1, limit: 20, lang: 'it' as const, search: 'veg' };
      const result = await controller.getTags(query);

      expect(result.items).toEqual([
        { id: 1, slug: 'vegetarian', name: 'Vegetariano', resolved_lang: 'it' },
      ]);
      expect(result.total).toBe(1);
      expect(mockCatalogService.getTags).toHaveBeenCalledWith(query);
    });

    it('forwards sort_by, sort_order, and pagination parameters to service.getTags', async () => {
      const query = {
        page: 2,
        limit: 10,
        lang: 'fr' as const,
        search: 'rapide',
        sort_by: 'slug' as const,
        sort_order: SortOrder.desc,
      };
      const result = await controller.getTags(query);

      expect(mockCatalogService.getTags).toHaveBeenCalledWith(query);
      expect(result).toEqual(
        expect.objectContaining({
          total: 1,
          page: 1,
          limit: 20,
          total_pages: 1,
          has_next_page: false,
          has_prev_page: false,
        }),
      );
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
      expect(mockCatalogService.getIngredients).toHaveBeenCalledWith(query);
    });

    it('forwards sort_by, sort_order, and pagination parameters to service.getIngredients', async () => {
      const query = {
        page: 3,
        limit: 5,
        lang: 'en' as const,
        category: IngredientCategory.dairy_eggs,
        search: 'milk',
        sort_by: 'name' as const,
        sort_order: SortOrder.desc,
      };
      const result = await controller.getIngredients(query);

      expect(mockCatalogService.getIngredients).toHaveBeenCalledWith(query);
      expect(result).toEqual(
        expect.objectContaining({
          total: 1,
          page: 1,
          limit: 20,
          total_pages: 1,
          has_next_page: false,
          has_prev_page: false,
        }),
      );
    });
  });

  describe('getTagById', () => {
    it('delegates to service.getTagById with numeric id and locale parameter', async () => {
      const result = await controller.getTagById(5, { lang: 'it' });

      expect(mockCatalogService.getTagById).toHaveBeenCalledWith(5, {
        lang: 'it',
      });
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

      expect(mockCatalogService.getIngredientById).toHaveBeenCalledWith(9, {
        lang: 'it',
      });
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
