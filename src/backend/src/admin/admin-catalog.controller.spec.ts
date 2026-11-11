import { Test, TestingModule } from '@nestjs/testing';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import { IngredientCategory, Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

describe('AdminCatalogController', () => {
  let controller: AdminCatalogController;
  let service: CatalogService;

  const mockAdminUser = {
    id: 1,
    username: 'admin',
    role: Role.admin,
    session: 1,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: {
            getIngredientDetail: jest.fn().mockResolvedValue({
              id: 9,
              slug: 'bell_pepper',
              category: IngredientCategory.produce,
              translations: {
                it: 'Peperone',
                en: 'Bell pepper',
                fr: 'Poivron',
              },
            }),
            getTagDetail: jest.fn().mockResolvedValue({
              id: 5,
              slug: 'gluten_free',
              translations: {
                it: 'Senza glutine',
                en: 'Gluten free',
                fr: 'Sans gluten',
              },
            }),
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
            updateIngredient: jest.fn().mockResolvedValue({
              id: 9,
              slug: 'bell_pepper',
              category: IngredientCategory.produce,
              translations: {
                it: 'Peperone',
                en: 'Bell pepper',
                fr: 'Poivron',
              },
            }),
            deleteIngredient: jest.fn().mockResolvedValue({
              message: "Ingredient 'bell_pepper' deleted successfully",
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
            deleteTag: jest.fn().mockResolvedValue({
              message: "Tag 'gluten_free' deleted successfully",
            }),
          },
        },
        { provide: JwtService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminCatalogController>(AdminCatalogController);
    service = module.get<CatalogService>(CatalogService);
  });

  describe('getIngredientById', () => {
    it('delegates to service.getIngredientDetail with numeric id', async () => {
      const result = await controller.getIngredientById(9);

      expect(service.getIngredientDetail).toHaveBeenCalledWith(9);
      expect(result).toEqual({
        id: 9,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: {
          it: 'Peperone',
          en: 'Bell pepper',
          fr: 'Poivron',
        },
      });
    });
  });

  describe('getTagById', () => {
    it('delegates to service.getTagDetail with numeric id', async () => {
      const result = await controller.getTagById(5);

      expect(service.getTagDetail).toHaveBeenCalledWith(5);
      expect(result).toEqual({
        id: 5,
        slug: 'gluten_free',
        translations: {
          it: 'Senza glutine',
          en: 'Gluten free',
          fr: 'Sans gluten',
        },
      });
    });
  });

  describe('createIngredient', () => {
    it('delegates to service.createIngredient with user and body', async () => {
      const dto = {
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
      };

      const result = await controller.createIngredient(mockAdminUser, dto);

      expect(service.createIngredient).toHaveBeenCalledWith(mockAdminUser, dto);
      expect(result.id).toBe(9);
    });
  });

  describe('updateIngredient', () => {
    it('delegates to service.updateIngredient with user, id, and body', async () => {
      const dto = {
        translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
      };

      const result = await controller.updateIngredient(mockAdminUser, 9, dto);

      expect(service.updateIngredient).toHaveBeenCalledWith(mockAdminUser, 9, dto);
      expect(result.id).toBe(9);
    });
  });

  describe('deleteIngredient', () => {
    it('delegates to service.deleteIngredient with user and id', async () => {
      const result = await controller.deleteIngredient(mockAdminUser, 9);

      expect(service.deleteIngredient).toHaveBeenCalledWith(mockAdminUser, 9);
      expect(result).toEqual({
        message: "Ingredient 'bell_pepper' deleted successfully",
      });
    });
  });

  describe('createTag', () => {
    it('delegates to service.createTag with user and body', async () => {
      const dto = {
        slug: 'gluten_free',
        translations: {
          it: 'Senza glutine',
          en: 'Gluten free',
          fr: 'Sans gluten',
        },
      };

      const result = await controller.createTag(mockAdminUser, dto);

      expect(service.createTag).toHaveBeenCalledWith(mockAdminUser, dto);
      expect(result.id).toBe(5);
    });
  });

  describe('updateTag', () => {
    it('delegates to service.updateTag with user, id, and body', async () => {
      const dto = {
        translations: {
          it: 'Senza glutine',
          en: 'Gluten free',
          fr: 'Sans gluten',
        },
      };

      const result = await controller.updateTag(mockAdminUser, 5, dto);

      expect(service.updateTag).toHaveBeenCalledWith(mockAdminUser, 5, dto);
      expect(result.id).toBe(5);
    });
  });

  describe('deleteTag', () => {
    it('delegates to service.deleteTag with user and id', async () => {
      const result = await controller.deleteTag(mockAdminUser, 5);

      expect(service.deleteTag).toHaveBeenCalledWith(mockAdminUser, 5);
      expect(result).toEqual({
        message: "Tag 'gluten_free' deleted successfully",
      });
    });
  });
});
