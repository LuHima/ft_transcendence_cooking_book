import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService, toTranslationDictionary } from './catalog.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory/casl-ability.factory';
import { Action } from '../auth/casl/action.enum';
import { Role } from '@prisma/client';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { HttpException, HttpStatus } from '@nestjs/common';
import { SortOrder } from '../common/dto/sort-order.enum';
import {
  Course,
  RecipeDifficulty,
  UnitOfMeasure,
  IngredientCategory,
} from '@prisma/client';

describe('CatalogService', () => {
  let service: CatalogService;
  let mockPrisma: {
    $queryRaw: jest.Mock;
    ingredient: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    tag: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    recipeIngredient: {
      count: jest.Mock;
    };
    recipeTag: {
      count: jest.Mock;
    };
  };
  let casl: { check: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      $queryRaw: jest.fn(),
      ingredient: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      tag: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      recipeIngredient: {
        count: jest.fn(),
      },
      recipeTag: {
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: CaslAbilityFactory,
          useValue: { check: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    casl = module.get(CaslAbilityFactory);
  });

  describe('getMeta', () => {
    it('should return all available static options and enums', () => {
      const meta = service.getMetadata();

      expect(meta).toHaveProperty('courses', Object.values(Course));
      expect(meta).toHaveProperty(
        'difficulties',
        Object.values(RecipeDifficulty),
      );
      expect(meta).toHaveProperty('units', Object.values(UnitOfMeasure));
      expect(meta).toHaveProperty(
        'categories',
        Object.values(IngredientCategory),
      );
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

    it('should return paginated tags localized in Italian when lang=it', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      mockPrisma.tag.count.mockResolvedValue(2);
      // Returned out of order by DB IN query to verify Map hydration preserves SQL order
      mockPrisma.tag.findMany.mockResolvedValue([mockDbTags[1], mockDbTags[0]]);

      const result = await service.getTags({ lang: 'it' });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: { id: { in: [1, 2] } },
        select: {
          id: true,
          slug: true,
          translations: { select: { locale: true, name: true } },
        },
      });
      expect(result).toEqual({
        items: [
          {
            id: 1,
            slug: 'vegetarian',
            name: 'Vegetariano',
            resolved_lang: 'it',
          },
          {
            id: 2,
            slug: 'quick_easy',
            name: 'Veloce e Facile',
            resolved_lang: 'it',
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      });
    });

    it('should default to English and name asc sorting when parameters are omitted', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 2 }, { id: 1 }]);
      mockPrisma.tag.count.mockResolvedValue(2);
      mockPrisma.tag.findMany.mockResolvedValue(mockDbTags);

      const result = await service.getTags({});

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.items).toEqual([
        {
          id: 2,
          slug: 'quick_easy',
          name: 'Quick & Easy',
          resolved_lang: 'en',
        },
        { id: 1, slug: 'vegetarian', name: 'Vegetarian', resolved_lang: 'en' },
      ]);
      expect(result.total).toBe(2);
    });

    it('should fall back to English if requested locale translation is missing', async () => {
      const tagWithOnlyEnglish = [
        {
          id: 3,
          slug: 'comfort_food',
          translations: [{ locale: 'en', name: 'Comfort Food' }],
        },
      ];
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 3 }]);
      mockPrisma.tag.count.mockResolvedValue(1);
      mockPrisma.tag.findMany.mockResolvedValue(tagWithOnlyEnglish);

      const result = await service.getTags({ lang: 'it' });

      expect(result.items).toEqual([
        {
          id: 3,
          slug: 'comfort_food',
          name: 'Comfort Food',
          resolved_lang: 'en',
        },
      ]);
    });

    it('supports localized name desc sorting and page slicing at DB level', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 2 }]);
      mockPrisma.tag.count.mockResolvedValue(2);
      mockPrisma.tag.findMany.mockResolvedValue([mockDbTags[1]]);

      const result = await service.getTags({
        lang: 'en',
        sort_by: 'name',
        sort_order: SortOrder.desc,
        page: 2,
        limit: 1,
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: { id: { in: [2] } },
        select: {
          id: true,
          slug: true,
          translations: { select: { locale: true, name: true } },
        },
      });
      expect(result).toEqual({
        items: [
          {
            id: 2,
            slug: 'quick_easy',
            name: 'Quick & Easy',
            resolved_lang: 'en',
          },
        ],
        total: 2,
        page: 2,
        limit: 1,
        total_pages: 2,
        has_next_page: false,
        has_prev_page: true,
      });
    });

    it('skips second findMany and returns has_prev_page=false when SQL page is empty and total=0', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.tag.count.mockResolvedValue(0);

      const result = await service.getTags({ page: 2, limit: 20 });

      expect(mockPrisma.tag.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({
        items: [],
        total: 0,
        page: 2,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      });
    });

    it('supports search and DB-level slug pagination when sort_by=slug', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([mockDbTags[1]]);
      mockPrisma.tag.count.mockResolvedValue(2);

      const result = await service.getTags({
        lang: 'fr',
        search: 'facile',
        sort_by: 'slug',
        sort_order: SortOrder.asc,
        page: 1,
        limit: 1,
      });

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { slug: { contains: 'facile', mode: 'insensitive' } },
            {
              translations: {
                some: { name: { contains: 'facile', mode: 'insensitive' } },
              },
            },
          ],
        },
        select: {
          id: true,
          slug: true,
          translations: { select: { locale: true, name: true } },
        },
        orderBy: { slug: 'asc' },
        skip: 0,
        take: 1,
      });
      expect(result).toEqual({
        items: [
          {
            id: 2,
            slug: 'quick_easy',
            name: 'Rapide et Facile',
            resolved_lang: 'fr',
          },
        ],
        total: 2,
        page: 1,
        limit: 1,
        total_pages: 2,
        has_next_page: true,
        has_prev_page: false,
      });
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

    it('should return paginated ingredients localized and sorted alphabetically in the requested language', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 2 }, { id: 1 }]);
      mockPrisma.ingredient.count.mockResolvedValue(2);
      // Returned out of order to verify Map hydration preserves SQL order
      mockPrisma.ingredient.findMany.mockResolvedValue([
        mockDbIngredients[0],
        mockDbIngredients[1],
      ]);

      const result = await service.getIngredients({ lang: 'it' });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith({
        where: { id: { in: [2, 1] } },
        select: {
          id: true,
          slug: true,
          category: true,
          translations: { select: { locale: true, name: true } },
        },
      });
      expect(result).toEqual({
        items: [
          {
            id: 2,
            slug: 'parmesan',
            category: IngredientCategory.dairy_eggs,
            name: 'Parmigiano Reggiano',
            resolved_lang: 'it',
          },
          {
            id: 1,
            slug: 'tomato',
            category: IngredientCategory.produce,
            name: 'Pomodoro',
            resolved_lang: 'it',
          },
        ],
        total: 2,
        page: 1,
        limit: 20,
        total_pages: 1,
        has_next_page: false,
        has_prev_page: false,
      });
    });

    it('should filter by category and search term in relational translations', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
      mockPrisma.ingredient.count.mockResolvedValue(1);
      mockPrisma.ingredient.findMany.mockResolvedValue([mockDbIngredients[0]]);

      const result = await service.getIngredients({
        lang: 'it',
        category: IngredientCategory.produce,
        search: 'pomo',
      });

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
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(mockPrisma.ingredient.count).toHaveBeenCalledWith({
        where: {
          category: IngredientCategory.produce,
          OR: [
            { slug: { contains: 'pomo', mode: 'insensitive' } },
            {
              translations: {
                some: {
                  name: { contains: 'pomo', mode: 'insensitive' },
                },
              },
            },
          ],
        },
      });
    });

    it('supports localized name desc sorting and page slicing at DB level', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 1 }]);
      mockPrisma.ingredient.count.mockResolvedValue(2);
      mockPrisma.ingredient.findMany.mockResolvedValue([mockDbIngredients[0]]);

      const result = await service.getIngredients({
        lang: 'it',
        sort_by: 'name',
        sort_order: SortOrder.desc,
        page: 1,
        limit: 1,
      });

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        items: [
          {
            id: 1,
            slug: 'tomato',
            category: IngredientCategory.produce,
            name: 'Pomodoro',
            resolved_lang: 'it',
          },
        ],
        total: 2,
        page: 1,
        limit: 1,
        total_pages: 2,
        has_next_page: true,
        has_prev_page: false,
      });
    });

    it('supports DB-level slug pagination when sort_by=slug', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([mockDbIngredients[1]]);
      mockPrisma.ingredient.count.mockResolvedValue(2);

      const result = await service.getIngredients({
        lang: 'en',
        sort_by: 'slug',
        sort_order: SortOrder.asc,
        page: 1,
        limit: 1,
      });

      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith({
        where: {},
        select: {
          id: true,
          slug: true,
          category: true,
          translations: { select: { locale: true, name: true } },
        },
        orderBy: { slug: 'asc' },
        skip: 0,
        take: 1,
      });
      expect(result).toEqual({
        items: [
          {
            id: 2,
            slug: 'parmesan',
            category: IngredientCategory.dairy_eggs,
            name: 'Parmesan',
            resolved_lang: 'en',
          },
        ],
        total: 2,
        page: 1,
        limit: 1,
        total_pages: 2,
        has_next_page: true,
        has_prev_page: false,
      });
    });
  });

  describe('createIngredient', () => {
    const admin: ActiveUserData = {
      id: 1,
      username: 'admin',
      role: Role.admin,
      session: 1,
    };
    const dto = {
      slug: 'bell_pepper',
      category: IngredientCategory.produce,
      translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
    };

    it('creates the ingredient with its three translations', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue(null);
      mockPrisma.ingredient.create.mockResolvedValue({
        id: 7,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: [
          { locale: 'fr', name: 'Poivron' },
          { locale: 'it', name: 'Peperone' },
          { locale: 'en', name: 'Bell pepper' },
        ],
      });

      const result = await service.createIngredient(admin, dto);

      expect(casl.check).toHaveBeenCalledWith(
        admin,
        Action.Create,
        'Ingredient',
      );
      expect(mockPrisma.ingredient.create).toHaveBeenCalledWith({
        data: {
          slug: 'bell_pepper',
          category: IngredientCategory.produce,
          translations: {
            create: [
              { locale: 'it', name: 'Peperone' },
              { locale: 'en', name: 'Bell pepper' },
              { locale: 'fr', name: 'Poivron' },
            ],
          },
        },
        include: { translations: true },
      });
      expect(result).toEqual({
        id: 7,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
      });
    });

    it('throws 409 when the slug already exists', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({ id: 3 });

      await expect(service.createIngredient(admin, dto)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(mockPrisma.ingredient.create).not.toHaveBeenCalled();
    });

    it('does not touch the database when CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(service.createIngredient(admin, dto)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(mockPrisma.ingredient.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.ingredient.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteIngredient', () => {
    const admin: ActiveUserData = {
      id: 1,
      username: 'admin',
      role: Role.admin,
      session: 1,
    };

    it('deletes an ingredient that is not used by any recipe', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 1,
        slug: 'bell_pepper',
      });
      mockPrisma.recipeIngredient.count.mockResolvedValue(0);
      mockPrisma.ingredient.delete.mockResolvedValue({});

      const result = await service.deleteIngredient(admin, 1);

      expect(casl.check).toHaveBeenCalledWith(
        admin,
        Action.Delete,
        'Ingredient',
      );
      expect(mockPrisma.ingredient.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual({
        message: "Ingredient 'bell_pepper' deleted successfully",
      });
    });

    it('throws 404 if the ingredient does not exist', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.deleteIngredient(admin, 99)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(mockPrisma.ingredient.delete).not.toHaveBeenCalled();
    });

    it('throws 409 if the ingredient is used by at least one recipe', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 1,
        slug: 'bell_pepper',
      });
      mockPrisma.recipeIngredient.count.mockResolvedValue(3);

      await expect(service.deleteIngredient(admin, 1)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(mockPrisma.ingredient.delete).not.toHaveBeenCalled();
    });

    it('throws 403 if CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(service.deleteIngredient(admin, 1)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(mockPrisma.ingredient.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('deleteTag', () => {
    const admin: ActiveUserData = {
      id: 1,
      username: 'admin',
      role: Role.admin,
      session: 1,
    };

    it('deletes a tag that is not used by any recipe', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 5,
        slug: 'gluten_free',
      });
      mockPrisma.recipeTag.count.mockResolvedValue(0);
      mockPrisma.tag.delete.mockResolvedValue({});

      const result = await service.deleteTag(admin, 5);

      expect(casl.check).toHaveBeenCalledWith(admin, Action.Delete, 'Tag');
      expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(result).toEqual({
        message: "Tag 'gluten_free' deleted successfully",
      });
    });

    it('throws 404 if the tag does not exist', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.deleteTag(admin, 99)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(mockPrisma.tag.delete).not.toHaveBeenCalled();
    });

    it('throws 409 if the tag is used by at least one recipe', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 5,
        slug: 'gluten_free',
      });
      mockPrisma.recipeTag.count.mockResolvedValue(2);

      await expect(service.deleteTag(admin, 5)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(mockPrisma.tag.delete).not.toHaveBeenCalled();
    });

    it('throws 403 if CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(service.deleteTag(admin, 5)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(mockPrisma.tag.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateIngredient', () => {
    const admin: ActiveUserData = {
      id: 1,
      username: 'admin',
      role: Role.admin,
      session: 1,
    };
    const dto = {
      translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
    };

    it('updates the three translations of an existing ingredient', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({ id: 7 });
      mockPrisma.ingredient.update.mockResolvedValue({
        id: 7,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: [
          { locale: 'it', name: 'Peperone' },
          { locale: 'en', name: 'Bell pepper' },
          { locale: 'fr', name: 'Poivron' },
        ],
      });

      const result = await service.updateIngredient(admin, 7, dto);

      expect(casl.check).toHaveBeenCalledWith(
        admin,
        Action.Update,
        'Ingredient',
      );
      expect(result).toEqual({
        id: 7,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
      });
    });

    it('throws 404 if the ingredient does not exist', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue(null);

      await expect(
        service.updateIngredient(admin, 99, dto),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(mockPrisma.ingredient.update).not.toHaveBeenCalled();
    });

    it('throws 403 if CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(
        service.updateIngredient(admin, 7, dto),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(mockPrisma.ingredient.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('createTag', () => {
    const admin: ActiveUserData = {
      id: 1,
      username: 'admin',
      role: Role.admin,
      session: 1,
    };
    const dto = {
      slug: 'gluten_free',
      translations: {
        it: 'Senza glutine',
        en: 'Gluten free',
        fr: 'Sans gluten',
      },
    };

    it('creates the tag with its three translations', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);
      mockPrisma.tag.create.mockResolvedValue({
        id: 5,
        slug: 'gluten_free',
        translations: [
          { locale: 'it', name: 'Senza glutine' },
          { locale: 'en', name: 'Gluten free' },
          { locale: 'fr', name: 'Sans gluten' },
        ],
      });

      const result = await service.createTag(admin, dto);

      expect(casl.check).toHaveBeenCalledWith(admin, Action.Create, 'Tag');
      expect(mockPrisma.tag.create).toHaveBeenCalledWith({
        data: {
          slug: 'gluten_free',
          translations: {
            create: [
              { locale: 'it', name: 'Senza glutine' },
              { locale: 'en', name: 'Gluten free' },
              { locale: 'fr', name: 'Sans gluten' },
            ],
          },
        },
        include: { translations: true },
      });
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

    it('throws 409 when the slug already exists', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({ id: 5 });

      await expect(service.createTag(admin, dto)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(mockPrisma.tag.create).not.toHaveBeenCalled();
    });

    it('does not touch the database when CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(service.createTag(admin, dto)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(mockPrisma.tag.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.tag.create).not.toHaveBeenCalled();
    });
  });

  describe('updateTag', () => {
    const admin: ActiveUserData = {
      id: 1,
      username: 'admin',
      role: Role.admin,
      session: 1,
    };
    const dto = {
      translations: {
        it: 'Senza glutine',
        en: 'Gluten free',
        fr: 'Sans gluten',
      },
    };

    it('updates the three translations of an existing tag', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({ id: 5 });
      mockPrisma.tag.update.mockResolvedValue({
        id: 5,
        slug: 'gluten_free',
        translations: [
          { locale: 'it', name: 'Senza glutine' },
          { locale: 'en', name: 'Gluten free' },
          { locale: 'fr', name: 'Sans gluten' },
        ],
      });

      const result = await service.updateTag(admin, 5, dto);

      expect(casl.check).toHaveBeenCalledWith(admin, Action.Update, 'Tag');
      expect(mockPrisma.tag.update).toHaveBeenCalledWith({
        where: { id: 5 },
        data: {
          translations: {
            upsert: [
              {
                where: { tag_id_locale: { tag_id: 5, locale: 'it' } },
                create: { locale: 'it', name: dto.translations.it },
                update: { name: dto.translations.it },
              },
              {
                where: { tag_id_locale: { tag_id: 5, locale: 'en' } },
                create: { locale: 'en', name: dto.translations.en },
                update: { name: dto.translations.en },
              },
              {
                where: { tag_id_locale: { tag_id: 5, locale: 'fr' } },
                create: { locale: 'fr', name: dto.translations.fr },
                update: { name: dto.translations.fr },
              },
            ],
          },
        },
        include: { translations: true },
      });
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

    it('throws 404 if the tag does not exist', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.updateTag(admin, 99, dto)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(mockPrisma.tag.update).not.toHaveBeenCalled();
    });

    it('throws 403 if CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(service.updateTag(admin, 5, dto)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(mockPrisma.tag.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('toTranslationDictionary helper', () => {
    it('formats translations into it, en, fr keys with empty fallback', () => {
      const dict = toTranslationDictionary([
        { locale: 'it', name: 'Pomodoro' },
        { locale: 'en', name: 'Tomato' },
      ]);
      expect(dict).toEqual({
        it: 'Pomodoro',
        en: 'Tomato',
        fr: '',
      });
    });
  });

  describe('getIngredientDetail (Admin)', () => {
    it('returns single ingredient with full multilingual translations map', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: [
          { locale: 'it', name: 'Peperone' },
          { locale: 'en', name: 'Bell pepper' },
          { locale: 'fr', name: 'Poivron' },
        ],
      });

      const result = await service.getIngredientDetail(12);

      expect(mockPrisma.ingredient.findUnique).toHaveBeenCalledWith({
        where: { id: 12 },
        include: { translations: true },
      });
      expect(result).toEqual({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: {
          it: 'Peperone',
          en: 'Bell pepper',
          fr: 'Poivron',
        },
      });
    });

    it('throws 404 when ingredient does not exist', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue(null);

      await expect(service.getIngredientDetail(999)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('getTagDetail (Admin)', () => {
    it('returns single tag with full multilingual translations map', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 1,
        slug: 'gluten_free',
        translations: [
          { locale: 'it', name: 'Senza glutine' },
          { locale: 'en', name: 'Gluten free' },
          { locale: 'fr', name: 'Sans gluten' },
        ],
      });

      const result = await service.getTagDetail(1);

      expect(mockPrisma.tag.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { translations: true },
      });
      expect(result).toEqual({
        id: 1,
        slug: 'gluten_free',
        translations: {
          it: 'Senza glutine',
          en: 'Gluten free',
          fr: 'Sans gluten',
        },
      });
    });

    it('throws 404 when tag does not exist', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.getTagDetail(999)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('getIngredientById (Public localized)', () => {
    it('returns localized ingredient for requested language', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: [
          { locale: 'it', name: 'Peperone' },
          { locale: 'en', name: 'Bell pepper' },
        ],
      });

      const result = await service.getIngredientById(12, { lang: 'it' });

      expect(mockPrisma.ingredient.findUnique).toHaveBeenCalledWith({
        where: { id: 12 },
        include: {
          translations: true,
        },
      });
      expect(result).toEqual({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        name: 'Peperone',
        resolved_lang: 'it',
      });
    });

    it('falls back to English when requested language translation is missing', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: [{ locale: 'en', name: 'Bell pepper' }],
      });

      const result = await service.getIngredientById(12, { lang: 'fr' });

      expect(result).toEqual({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        name: 'Bell pepper',
        resolved_lang: 'en',
      });
    });

    it('falls back to first available language when requested and English translations are missing (ADR 0031)', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: [{ locale: 'it', name: 'Peperone' }],
      });

      const result = await service.getIngredientById(12, { lang: 'fr' });

      expect(result).toEqual({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        name: 'Peperone',
        resolved_lang: 'it',
      });
    });

    it('falls back to slug when translations are empty', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        translations: [],
      });

      const result = await service.getIngredientById(12, { lang: 'fr' });

      expect(result).toEqual({
        id: 12,
        slug: 'bell_pepper',
        category: IngredientCategory.produce,
        name: 'bell_pepper',
        resolved_lang: 'en',
      });
    });

    it('throws 404 when ingredient does not exist', async () => {
      mockPrisma.ingredient.findUnique.mockResolvedValue(null);

      await expect(
        service.getIngredientById(999, { lang: 'it' }),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('getTagById (Public localized)', () => {
    it('returns localized tag for requested language', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 1,
        slug: 'gluten_free',
        translations: [
          { locale: 'it', name: 'Senza glutine' },
          { locale: 'en', name: 'Gluten free' },
        ],
      });

      const result = await service.getTagById(1, { lang: 'it' });

      expect(mockPrisma.tag.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          translations: true,
        },
      });
      expect(result).toEqual({
        id: 1,
        slug: 'gluten_free',
        name: 'Senza glutine',
        resolved_lang: 'it',
      });
    });

    it('falls back to English when requested language translation is missing', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 1,
        slug: 'gluten_free',
        translations: [{ locale: 'en', name: 'Gluten free' }],
      });

      const result = await service.getTagById(1, { lang: 'fr' });

      expect(result).toEqual({
        id: 1,
        slug: 'gluten_free',
        name: 'Gluten free',
        resolved_lang: 'en',
      });
    });

    it('falls back to first available language when requested and English translations are missing (ADR 0031)', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 1,
        slug: 'gluten_free',
        translations: [{ locale: 'it', name: 'Senza glutine' }],
      });

      const result = await service.getTagById(1, { lang: 'fr' });

      expect(result).toEqual({
        id: 1,
        slug: 'gluten_free',
        name: 'Senza glutine',
        resolved_lang: 'it',
      });
    });

    it('falls back to slug when translations are empty', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue({
        id: 1,
        slug: 'gluten_free',
        translations: [],
      });

      const result = await service.getTagById(1, { lang: 'fr' });

      expect(result).toEqual({
        id: 1,
        slug: 'gluten_free',
        name: 'gluten_free',
        resolved_lang: 'en',
      });
    });

    it('throws 404 when tag does not exist', async () => {
      mockPrisma.tag.findUnique.mockResolvedValue(null);

      await expect(
        service.getTagById(999, { lang: 'it' }),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('getAdminIngredients', () => {
    it('returns paginated ingredients with full multilingual dictionaries and default sorting', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([
        {
          id: 1,
          slug: 'bell_pepper',
          category: IngredientCategory.produce,
          translations: [
            { locale: 'it', name: 'Peperone' },
            { locale: 'en', name: 'Bell pepper' },
            { locale: 'fr', name: 'Poivron' },
          ],
        },
      ]);
      mockPrisma.ingredient.count.mockResolvedValue(25);

      const result = await service.getAdminIngredients();

      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith({
        where: {},
        select: {
          id: true,
          slug: true,
          category: true,
          translations: { select: { locale: true, name: true } },
        },
        orderBy: { id: 'asc' },
        skip: 0,
        take: 20,
      });
      expect(mockPrisma.ingredient.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({
        items: [
          {
            id: 1,
            slug: 'bell_pepper',
            category: IngredientCategory.produce,
            translations: {
              it: 'Peperone',
              en: 'Bell pepper',
              fr: 'Poivron',
            },
          },
        ],
        total: 25,
        page: 1,
        limit: 20,
        total_pages: 2,
        has_next_page: true,
        has_prev_page: false,
      });
    });

    it('applies category, search, custom page/limit, and slug desc sorting', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([]);
      mockPrisma.ingredient.count.mockResolvedValue(0);

      const result = await service.getAdminIngredients({
        page: 2,
        limit: 10,
        category: IngredientCategory.dairy_eggs,
        search: '  milk ',
        sort_by: 'slug',
        sort_order: SortOrder.desc,
      });

      const expectedWhere = {
        category: IngredientCategory.dairy_eggs,
        OR: [
          { slug: { contains: 'milk', mode: 'insensitive' } },
          {
            translations: {
              some: { name: { contains: 'milk', mode: 'insensitive' } },
            },
          },
        ],
      };

      expect(mockPrisma.ingredient.findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        select: {
          id: true,
          slug: true,
          category: true,
          translations: { select: { locale: true, name: true } },
        },
        orderBy: { slug: 'desc' },
        skip: 10,
        take: 10,
      });
      expect(result).toEqual({
        items: [],
        total: 0,
        page: 2,
        limit: 10,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      });
    });
  });

  describe('getAdminTags', () => {
    it('returns paginated tags with full multilingual dictionaries', async () => {
      mockPrisma.tag.findMany.mockResolvedValue([
        {
          id: 5,
          slug: 'gluten_free',
          translations: [
            { locale: 'it', name: 'Senza glutine' },
            { locale: 'en', name: 'Gluten free' },
            { locale: 'fr', name: 'Sans gluten' },
          ],
        },
      ]);
      mockPrisma.tag.count.mockResolvedValue(1);

      const result = await service.getAdminTags({
        page: 1,
        limit: 20,
        search: 'glutine',
        sort_by: 'slug',
        sort_order: SortOrder.asc,
      });

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { slug: { contains: 'glutine', mode: 'insensitive' } },
            {
              translations: {
                some: { name: { contains: 'glutine', mode: 'insensitive' } },
              },
            },
          ],
        },
        select: {
          id: true,
          slug: true,
          translations: { select: { locale: true, name: true } },
        },
        orderBy: { slug: 'asc' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
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
      });
    });
  });
});
