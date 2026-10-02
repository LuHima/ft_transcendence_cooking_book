import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Course, RecipeDifficulty, UnitOfMeasure, IngredientCategory } from '@prisma/client';

describe('CatalogController', () => {
  let controller: CatalogController;
  let service: CatalogService;

  const mockMeta = {
    courses: Object.values(Course),
    difficulties: Object.values(RecipeDifficulty),
    units: Object.values(UnitOfMeasure),
    categories: Object.values(IngredientCategory),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: {
            getMeta: jest.fn().mockReturnValue(mockMeta),
            getTags: jest.fn().mockResolvedValue([{ id: 1, slug: 'vegetarian', name: 'Vegetariano' }]),
            getIngredients: jest.fn().mockResolvedValue([
              { id: 1, slug: 'tomato', category: IngredientCategory.produce, name: 'Pomodoro' },
            ]),
          },
        },
      ],
    }).compile();

    controller = module.get<CatalogController>(CatalogController);
    service = module.get<CatalogService>(CatalogService);
  });

  describe('getMeta', () => {
    it('should return catalog metadata from service', () => {
      const result = controller.getMeta();

      expect(result).toEqual(mockMeta);
      expect(service.getMeta).toHaveBeenCalled();
    });
  });

  describe('getTags', () => {
    it('should delegate to service.getTags with lang parameter', async () => {
      const result = await controller.getTags('it');

      expect(result).toEqual([{ id: 1, slug: 'vegetarian', name: 'Vegetariano' }]);
      expect(service.getTags).toHaveBeenCalledWith({ lang: 'it' });
    });
  });

  describe('getIngredients', () => {
    it('should delegate to service.getIngredients with query parameters', async () => {
      const result = await controller.getIngredients('it', IngredientCategory.produce, 'pomo');

      expect(result).toEqual([
        { id: 1, slug: 'tomato', category: IngredientCategory.produce, name: 'Pomodoro' },
      ]);
      expect(service.getIngredients).toHaveBeenCalledWith({
        lang: 'it',
        category: IngredientCategory.produce,
        search: 'pomo',
      });
    });
  });
});
