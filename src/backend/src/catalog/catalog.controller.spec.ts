import { Test, TestingModule } from '@nestjs/testing';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import {
  Course,
  RecipeDifficulty,
  UnitOfMeasure,
  IngredientCategory,
  Role,
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
              translations: {
                it: 'Peperone',
                en: 'Bell pepper',
                fr: 'Poivron',
              },
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
            createTag: jest.fn().mockResolvedValue({
              id: 5,
              slug: 'gluten_free',
              translations: {
                it: 'Senza glutine',
                en: 'Gluten free',
                fr: 'Sans gluten',
              },
            }),
            updateTag: jest.fn().mockResolvedValue({
              id: 5,
              slug: 'gluten_free',
              translations: {
                it: 'Senza glutine',
                en: 'Gluten free',
                fr: 'Sans gluten',
              },
            }),
            getTagById: jest.fn().mockResolvedValue({
              id: 5,
              slug: 'gluten_free',
              translations: {
                it: 'Senza glutine',
                en: 'Gluten free',
                fr: 'Sans gluten',
              },
            }),
            getIngredientById: jest.fn().mockResolvedValue({
              id: 9,
              slug: 'bell_pepper',
              category: IngredientCategory.produce,
              translations: {
                it: 'Peperone',
                en: 'Bell pepper',
                fr: 'Poivron',
              },
            }),
            updateIngredient: jest.fn().mockResolvedValue({
              id: 7,
              slug: 'bell_pepper',
              category: IngredientCategory.produce,
              translations: {
                it: 'Peperone',
                en: 'Bell pepper',
                fr: 'Poivron',
              },
            }),
          },
        },
        { provide: JwtService, useValue: {} },
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
      const user = {
        id: 1,
        username: 'admin',
        role: 'admin',
        session: 1,
      } as any;
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
  describe('createTag', () => {
    it('delegates to service.createTag with user and body', async () => {
      const user = { id: 1, role: Role.admin } as any;
      const dto = {
        slug: 'gluten_free',
        translations: {
          it: 'Senza glutine',
          en: 'Gluten free',
          fr: 'Sans gluten',
        },
      };

      const result = await controller.createTag(user, dto);

      expect(service.createTag).toHaveBeenCalledWith(user, dto);
      expect(result.id).toBe(5);
    });
  });

  describe('updateTag', () => {
    it('delegates to service.updateTag with user, id and body', async () => {
      const user = { id: 1, role: Role.admin } as any;
      const dto = {
        translations: {
          it: 'Senza glutine',
          en: 'Gluten free',
          fr: 'Sans gluten',
        },
      };

      const result = await controller.updateTag(user, 5, dto);

      expect(service.updateTag).toHaveBeenCalledWith(user, 5, dto);
      expect(result.id).toBe(5);
    });
  });

  describe('updateIngredient', () => {
    it('delegates to service.updateIngredient with user, id and body', async () => {
      const user = { id: 1, role: Role.admin } as any;
      const dto = {
        translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
      };

      const result = await controller.updateIngredient(user, 7, dto);

      expect(service.updateIngredient).toHaveBeenCalledWith(user, 7, dto);
      expect(result.id).toBe(7);
    });
  });

  describe('getTagById (Ticket #153)', () => {
    it('delegates to service.getTagById with numeric id', async () => {
      const result = await controller.getTagById(5);

      expect(service.getTagById).toHaveBeenCalledWith(5);
      expect(result.id).toBe(5);
      expect(result.translations).toEqual({
        it: 'Senza glutine',
        en: 'Gluten free',
        fr: 'Sans gluten',
      });
    });
  });

  describe('getIngredientById (Ticket #153)', () => {
    it('delegates to service.getIngredientById with numeric id', async () => {
      const result = await controller.getIngredientById(9);

      expect(service.getIngredientById).toHaveBeenCalledWith(9);
      expect(result.id).toBe(9);
      expect(result.category).toBe(IngredientCategory.produce);
      expect(result.translations).toEqual({
        it: 'Peperone',
        en: 'Bell pepper',
        fr: 'Poivron',
      });
    });
  });
});
