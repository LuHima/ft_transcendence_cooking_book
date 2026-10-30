import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CaslAbilityFactory } from '../auth/casl/casl-ability.factory/casl-ability.factory';
import { Action } from '../auth/casl/action.enum';
import { Role } from '@prisma/client';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { createHttpException, errors } from '../common/config/error.config';
import { HttpException, HttpStatus } from '@nestjs/common';
import {
  Course,
  RecipeDifficulty,
  UnitOfMeasure,
  IngredientCategory,
} from '@prisma/client';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: PrismaService;
  let casl: { check: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: {
            ingredient: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            tag: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
            },
            recipeIngredient: {
              count: jest.fn(),
            },
            recipeTag: {
              count: jest.fn(),
            },
          },
        },
        {
          provide: CaslAbilityFactory,
          useValue: { check: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    prisma = module.get<PrismaService>(PrismaService);
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

    it('should return tags localized in Italian when lang=it', async () => {
      (prisma.tag.findMany as jest.Mock).mockResolvedValue(mockDbTags);

      const result = await service.getTags({ lang: 'it' });

      expect(result).toEqual([
        { id: 1, slug: 'vegetarian', name: 'Vegetariano', resolved_lang: 'it' },
        {
          id: 2,
          slug: 'quick_easy',
          name: 'Veloce e Facile',
          resolved_lang: 'it',
        },
      ]);
    });

    it('should default to English when lang is not provided or unsupported', async () => {
      (prisma.tag.findMany as jest.Mock).mockResolvedValue(mockDbTags);

      const result = await service.getTags({});

      expect(result).toEqual([
        {
          id: 2,
          slug: 'quick_easy',
          name: 'Quick & Easy',
          resolved_lang: 'en',
        },
        { id: 1, slug: 'vegetarian', name: 'Vegetarian', resolved_lang: 'en' },
      ]);
    });

    it('should fall back to English if requested locale translation is missing', async () => {
      const tagWithOnlyEnglish = [
        {
          id: 3,
          slug: 'comfort_food',
          translations: [{ locale: 'en', name: 'Comfort Food' }],
        },
      ];
      (prisma.tag.findMany as jest.Mock).mockResolvedValue(tagWithOnlyEnglish);

      const result = await service.getTags({ lang: 'it' });

      expect(result).toEqual([
        {
          id: 3,
          slug: 'comfort_food',
          name: 'Comfort Food',
          resolved_lang: 'en',
        },
      ]);
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

    it('should return ingredients localized in the requested language', async () => {
      (prisma.ingredient.findMany as jest.Mock).mockResolvedValue(
        mockDbIngredients,
      );

      const result = await service.getIngredients({ lang: 'it' });

      expect(result).toEqual([
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
      ]);
    });

    it('should filter by category and search term in relational translations', async () => {
      (prisma.ingredient.findMany as jest.Mock).mockResolvedValue([
        mockDbIngredients[0],
      ]);

      const result = await service.getIngredients({
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
      expect(prisma.ingredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: IngredientCategory.produce,
            OR: expect.arrayContaining([
              { slug: { contains: 'pomo', mode: 'insensitive' } },
              {
                translations: {
                  some: {
                    name: { contains: 'pomo', mode: 'insensitive' },
                  },
                },
              },
            ]),
          }),
        }),
      );
    });
  });

  describe('createIngredient', () => {
    const admin = { id: 1, username: 'admin', role: 'admin', session: 1 } as any;
    const dto = {
      slug: 'bell_pepper',
      category: IngredientCategory.produce,
      translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
    };

    it('creates the ingredient with its three translations', async () => {
      (prisma.ingredient.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.ingredient.create as jest.Mock).mockResolvedValue({
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
      expect(prisma.ingredient.create).toHaveBeenCalledWith({
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
      (prisma.ingredient.findUnique as jest.Mock).mockResolvedValue({ id: 3 });

      await expect(service.createIngredient(admin, dto)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(prisma.ingredient.create).not.toHaveBeenCalled();
    });

    it('does not touch the database when CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(service.createIngredient(admin, dto)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(prisma.ingredient.findUnique).not.toHaveBeenCalled();
      expect(prisma.ingredient.create).not.toHaveBeenCalled();
    });
  });
  
  describe('deleteIngredient', () => {
    const admin = { id: 1, username: 'admin', role: 'admin', session: 1 } as any;

    it('deletes an ingredient that is not used by any recipe', async () => {
      (prisma.ingredient.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        slug: 'bell_pepper',
      });
      (prisma.recipeIngredient.count as jest.Mock).mockResolvedValue(0);
      (prisma.ingredient.delete as jest.Mock).mockResolvedValue({});

      const result = await service.deleteIngredient(admin, 1);

      expect(casl.check).toHaveBeenCalledWith(
        admin,
        Action.Delete,
        'Ingredient',
      );
      expect(prisma.ingredient.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual({
        message: "Ingredient 'bell_pepper' deleted successfully",
      });
    });

    it('throws 404 if the ingredient does not exist', async () => {
      (prisma.ingredient.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteIngredient(admin, 99)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(prisma.ingredient.delete).not.toHaveBeenCalled();
    });

    it('throws 409 if the ingredient is used by at least one recipe', async () => {
      (prisma.ingredient.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        slug: 'bell_pepper',
      });
      (prisma.recipeIngredient.count as jest.Mock).mockResolvedValue(3);

      await expect(service.deleteIngredient(admin, 1)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(prisma.ingredient.delete).not.toHaveBeenCalled();
    });

    it('throws 403 if CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(service.deleteIngredient(admin, 1)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(prisma.ingredient.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('deleteTag', () => {
    const admin = { id: 1, username: 'admin', role: 'admin', session: 1 } as any;

    it('deletes a tag that is not used by any recipe', async () => {
      (prisma.tag.findUnique as jest.Mock).mockResolvedValue({
        id: 5,
        slug: 'gluten_free',
      });
      (prisma.recipeTag.count as jest.Mock).mockResolvedValue(0);
      (prisma.tag.delete as jest.Mock).mockResolvedValue({});

      const result = await service.deleteTag(admin, 5);

      expect(casl.check).toHaveBeenCalledWith(admin, Action.Delete, 'Tag');
      expect(prisma.tag.delete).toHaveBeenCalledWith({ where: { id: 5 } });
      expect(result).toEqual({
        message: "Tag 'gluten_free' deleted successfully",
      });
    });

    it('throws 404 if the tag does not exist', async () => {
      (prisma.tag.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteTag(admin, 99)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(prisma.tag.delete).not.toHaveBeenCalled();
    });

    it('throws 409 if the tag is used by at least one recipe', async () => {
      (prisma.tag.findUnique as jest.Mock).mockResolvedValue({
        id: 5,
        slug: 'gluten_free',
      });
      (prisma.recipeTag.count as jest.Mock).mockResolvedValue(2);

      await expect(service.deleteTag(admin, 5)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(prisma.tag.delete).not.toHaveBeenCalled();
    });

    it('throws 403 if CASL denies the action', async () => {
      casl.check.mockImplementation(() => {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      });

      await expect(service.deleteTag(admin, 5)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
      expect(prisma.tag.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('updateIngredient', () => {
    const admin = { id: 1, username: 'admin', role: 'admin', session: 1 } as any;
    const dto = {
      translations: { it: 'Peperone', en: 'Bell pepper', fr: 'Poivron' },
    };

    it('updates the three translations of an existing ingredient', async () => {
      (prisma.ingredient.findUnique as jest.Mock).mockResolvedValue({ id: 7 });
      (prisma.ingredient.update as jest.Mock).mockResolvedValue({
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
      (prisma.ingredient.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateIngredient(admin, 99, dto),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
      expect(prisma.ingredient.update).not.toHaveBeenCalled();
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
      expect(prisma.ingredient.findUnique).not.toHaveBeenCalled();
    });
  });
});
