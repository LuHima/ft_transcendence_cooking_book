import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { Role } from '@prisma/client';
import { CatalogService } from './catalog.service';
import {
  Course,
  RecipeDifficulty,
  UnitOfMeasure,
  IngredientCategory,
} from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from 'src/common/guards/auth.guard';

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
            getTags: jest
              .fn()
              .mockResolvedValue([
                { id: 1, slug: 'vegetarian', name: 'Vegetariano' },
              ]),
            createIngredient: jest.fn().mockResolvedValue({
              id: 9,
              slug: 'bell_pepper',
              category: IngredientCategory.produce,
              translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
            }),
            getIngredients: jest.fn().mockResolvedValue([
              {
                id: 1,
                slug: 'tomato',
                category: IngredientCategory.produce,
                name: 'Pomodoro',
              },
            ]),
            deleteIngredient: jest.fn().mockResolvedValue({
              message: "Ingredient 'bell_pepper' deleted successfully",
            }),
            deleteTag: jest.fn().mockResolvedValue({
              message: "Tag 'gluten_free' deleted successfully",
            }),
          },
        },
        { provide: JwtService, useValue: {}},
      ],
    })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<CatalogController>(CatalogController);
    service = module.get<CatalogService>(CatalogService);
  });

  describe('getTags', () => {
    it('should delegate to service.getTags with lang parameter', async () => {
      const result = await controller.getTags({ lang: 'it' });

      expect(result).toEqual([
        { id: 1, slug: 'vegetarian', name: 'Vegetariano' },
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
        },
      ]);
      expect(service.getIngredients).toHaveBeenCalledWith({
        lang: 'it',
        category: IngredientCategory.produce,
        search: 'pomo',
      });
    });
  });

  describe('createIngredient', () => {
    it('should delegate to service.createIngredient with user and body', async () => {
      const user = { id: 1, username: 'admin', role: 'admin', session: 1 } as any;
      const dto = {
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
      };

      const result = await controller.createIngredient(user, dto);

      expect(result).toMatchObject({ id: 9, slug: 'bell_pepper' });
      expect(service.createIngredient).toHaveBeenCalledWith(user, dto);
    });
  });
  
  describe('deleteIngredient', () => {
    it('delegates to service.deleteIngredient with user and id', async () => {
      const user = { id: 1, role: Role.admin } as any;

      const result = await controller.deleteIngredient(user, 1);

      expect(service.deleteIngredient).toHaveBeenCalledWith(user, 1);
      expect(result).toEqual({
        message: "Ingredient 'bell_pepper' deleted successfully",
      });
    });
  });

  describe('deleteTag', () => {
    it('delegates to service.deleteTag with user and id', async () => {
      const user = { id: 1, role: Role.admin } as any;

      const result = await controller.deleteTag(user, 5);

      expect(service.deleteTag).toHaveBeenCalledWith(user, 5);
      expect(result).toEqual({
        message: "Tag 'gluten_free' deleted successfully",
      });
    });
  });
});
