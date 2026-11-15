import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminCatalogController } from './admin-catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import { IngredientCategory, Role } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { SortOrder } from '../common/dto/sort-order.enum';
import { ActiveUserData } from '../common/decorators/current-user.decorator';

describe('AdminCatalogController', () => {
  let controller: AdminCatalogController;
  let mockCatalogService: {
    getAdminIngredients: jest.Mock;
    getAdminTags: jest.Mock;
    getIngredientDetail: jest.Mock;
    getTagDetail: jest.Mock;
    createIngredient: jest.Mock;
    updateIngredient: jest.Mock;
    deleteIngredient: jest.Mock;
    createTag: jest.Mock;
    updateTag: jest.Mock;
    deleteTag: jest.Mock;
  };

  const mockAdminUser: ActiveUserData = {
    id: 1,
    username: 'admin',
    role: Role.admin,
    session: 1,
  };

  beforeEach(async () => {
    mockCatalogService = {
      getAdminIngredients: jest.fn().mockResolvedValue({
        items: [
          {
            id: 9,
            slug: 'bell_pepper',
            category: IngredientCategory.produce,
            translations: {
              it: 'Peperone',
              en: 'Bell pepper',
              fr: 'Poivron',
            },
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      }),
      getAdminTags: jest.fn().mockResolvedValue({
        items: [
          {
            id: 5,
            slug: 'gluten_free',
            translations: {
              it: 'Senza glutine',
              en: 'Gluten free',
              fr: 'Sans gluten',
            },
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      }),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminCatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: mockCatalogService,
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
  });

  describe('RBAC metadata', () => {
    it('enforces AuthGuard, RolesGuard, and admin role metadata on the controller', () => {
      const roles = Reflect.getMetadata(ROLES_KEY, AdminCatalogController) as
        string[] | undefined;
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        AdminCatalogController,
      ) as unknown[] | undefined;

      expect(roles).toEqual(['admin']);
      expect(guards).toEqual(expect.arrayContaining([AuthGuard, RolesGuard]));
    });
  });

  describe('getIngredients', () => {
    it('delegates to service.getAdminIngredients with query params', async () => {
      const query = {
        page: 2,
        limit: 10,
        category: IngredientCategory.produce,
        search: 'bell',
        sort_by: 'slug' as const,
        sort_order: SortOrder.desc,
      };
      const result = await controller.getIngredients(query);

      expect(mockCatalogService.getAdminIngredients).toHaveBeenCalledWith(
        query,
      );
      expect(result.total).toBe(1);
      expect(result.items[0].slug).toBe('bell_pepper');
    });
  });

  describe('getTags', () => {
    it('delegates to service.getAdminTags with query params', async () => {
      const query = {
        page: 2,
        limit: 15,
        search: 'gluten',
        sort_by: 'id' as const,
        sort_order: SortOrder.asc,
      };
      const result = await controller.getTags(query);

      expect(mockCatalogService.getAdminTags).toHaveBeenCalledWith(query);
      expect(result.total).toBe(1);
      expect(result.items[0].slug).toBe('gluten_free');
    });
  });

  describe('getIngredientById', () => {
    it('delegates to service.getIngredientDetail with numeric id', async () => {
      const result = await controller.getIngredientById(9);

      expect(mockCatalogService.getIngredientDetail).toHaveBeenCalledWith(9);
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

      expect(mockCatalogService.getTagDetail).toHaveBeenCalledWith(5);
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

      expect(mockCatalogService.createIngredient).toHaveBeenCalledWith(
        mockAdminUser,
        dto,
      );
      expect(result.id).toBe(9);
    });
  });

  describe('updateIngredient', () => {
    it('delegates to service.updateIngredient with user, id, and body', async () => {
      const dto = {
        translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
      };

      const result = await controller.updateIngredient(mockAdminUser, 9, dto);

      expect(mockCatalogService.updateIngredient).toHaveBeenCalledWith(
        mockAdminUser,
        9,
        dto,
      );
      expect(result.id).toBe(9);
    });
  });

  describe('deleteIngredient', () => {
    it('delegates to service.deleteIngredient with user and id', async () => {
      const result = await controller.deleteIngredient(mockAdminUser, 9);

      expect(mockCatalogService.deleteIngredient).toHaveBeenCalledWith(
        mockAdminUser,
        9,
      );
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

      expect(mockCatalogService.createTag).toHaveBeenCalledWith(
        mockAdminUser,
        dto,
      );
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

      expect(mockCatalogService.updateTag).toHaveBeenCalledWith(
        mockAdminUser,
        5,
        dto,
      );
      expect(result.id).toBe(5);
    });
  });

  describe('deleteTag', () => {
    it('delegates to service.deleteTag with user and id', async () => {
      const result = await controller.deleteTag(mockAdminUser, 5);

      expect(mockCatalogService.deleteTag).toHaveBeenCalledWith(
        mockAdminUser,
        5,
      );
      expect(result).toEqual({
        message: "Tag 'gluten_free' deleted successfully",
      });
    });
  });
});
