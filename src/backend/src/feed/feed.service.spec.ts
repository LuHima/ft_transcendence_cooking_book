/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { FeedService } from './feed.service';
import { PrismaService } from 'prisma/prisma.service';
import { Course, RecipeDifficulty, TranslationStatus } from '@prisma/client';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('FeedService', () => {
  let service: FeedService;
  let prisma: PrismaService;

  const mockDate = new Date('2026-10-20T10:00:00Z');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        {
          provide: PrismaService,
          useValue: {
            friendship: {
              findMany: jest.fn(),
            },
            recipe: {
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getFeed - Zero-Cost Short Circuit', () => {
    it('returns empty collection and skips recipe queries when caller has zero confirmed friends', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([]);

      const result = await service.getFeed(1, { page: 1, limit: 20 });

      expect(prisma.friendship.findMany).toHaveBeenCalledWith({
        where: {
          status: 'accepted',
          OR: [{ requester_id: 1 }, { addressee_id: 1 }],
        },
        select: { requester_id: true, addressee_id: true },
      });
      expect(prisma.recipe.findMany).not.toHaveBeenCalled();
      expect(prisma.recipe.count).not.toHaveBeenCalled();

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      });
    });
  });

  describe('getFeed - Friends Query & Invariants', () => {
    it('resolves friend IDs whether caller is requester or addressee, excluding non-friends and self', async () => {
      const mockFriendships = [
        { requester_id: 1, addressee_id: 2 }, // caller is requester, friend is 2
        { requester_id: 3, addressee_id: 1 }, // caller is addressee, friend is 3
      ];
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue(
        mockFriendships,
      );
      (prisma.recipe.findMany as jest.Mock<any>).mockResolvedValue([]);
      (prisma.recipe.count as jest.Mock<any>).mockResolvedValue(0);

      const result = await service.getFeed(1, { page: 1, limit: 20 });

      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            user_id: { in: [2, 3] },
            user: {
              status: 'active',
              deleted_at: null,
            },
          },
          orderBy: { created_at: 'desc' },
          skip: 0,
          take: 20,
        }),
      );
      expect(prisma.recipe.count).toHaveBeenCalledWith({
        where: {
          user_id: { in: [2, 3] },
          user: {
            status: 'active',
            deleted_at: null,
          },
        },
      });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty collection when caller has friends but none have published recipes', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
        { requester_id: 1, addressee_id: 5 },
      ]);
      (prisma.recipe.findMany as jest.Mock<any>).mockResolvedValue([]);
      (prisma.recipe.count as jest.Mock<any>).mockResolvedValue(0);

      const result = await service.getFeed(1, { page: 1, limit: 20 });

      expect(result).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      });
    });
  });

  describe('getFeed - Recipe mapping, Contextual Likes, and Sorting', () => {
    it('maps recipe summaries correctly with author profile, tags, counts, and contextual is_liked', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
        { requester_id: 1, addressee_id: 2 },
      ]);

      const mockRecipes = [
        {
          id: 101,
          course: Course.first_course,
          difficulty: RecipeDifficulty.medium,
          prep_time: 15,
          cook_time: 10,
          total_time: 25,
          servings: 4,
          source_lang: 'it',
          translation_status: TranslationStatus.completed,
          cover_image_url: '/uploads/recipes/carbonara.webp',
          video_url: null,
          created_at: mockDate,
          updated_at: mockDate,
          user: {
            id: 2,
            username: 'chef_luigi',
            avatar_url: '/uploads/avatars/luigi.webp',
          },
          translations: [
            {
              locale: 'it',
              title: 'Spaghetti alla Carbonara',
              description: 'Classico romano con guanciale',
            },
            {
              locale: 'en',
              title: 'Spaghetti Carbonara',
              description: 'Roman classic with cured pork jowl',
            },
          ],
          recipe_tags: [
            {
              tag: {
                id: 1,
                slug: 'traditional',
                translations: [
                  { locale: 'it', name: 'Tradizionale' },
                  { locale: 'en', name: 'Traditional' },
                ],
              },
            },
          ],
          _count: {
            likes: 42,
            comments: 5,
          },
          likes: [{ user_id: 1 }], // Caller liked this recipe
        },
        {
          id: 102,
          course: Course.dessert,
          difficulty: RecipeDifficulty.easy,
          prep_time: 20,
          cook_time: 0,
          total_time: 20,
          servings: 6,
          source_lang: 'it',
          translation_status: TranslationStatus.completed,
          cover_image_url: '/uploads/recipes/tiramisu.webp',
          video_url: null,
          created_at: new Date('2026-10-19T10:00:00Z'),
          updated_at: null,
          user: {
            id: 2,
            username: 'chef_luigi',
            avatar_url: '/uploads/avatars/luigi.webp',
          },
          translations: [
            {
              locale: 'it',
              title: 'Tiramisù Tradizionale',
              description: 'Delizioso dolce al mascarpone e caffè',
            },
          ],
          recipe_tags: [],
          _count: {
            likes: 12,
            comments: 0,
          },
          likes: [], // Caller did NOT like this recipe
        },
      ];

      (prisma.recipe.findMany as jest.Mock<any>).mockResolvedValue(mockRecipes);
      (prisma.recipe.count as jest.Mock<any>).mockResolvedValue(2);

      const result = await service.getFeed(1, {
        page: 1,
        limit: 20,
        lang: 'en',
      });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);

      // Verify recipe 101 (liked, translated to English)
      const item1 = result.items[0];
      expect(item1.id).toBe(101);
      expect(item1.title).toBe('Spaghetti Carbonara');
      expect(item1.description).toBe('Roman classic with cured pork jowl');
      expect(item1.resolved_lang).toBe('en');
      expect(item1.is_liked).toBe(true);
      expect(item1.likes_count).toBe(42);
      expect(item1.comments_count).toBe(5);
      expect(item1.author).toEqual({
        id: 2,
        username: 'chef_luigi',
        avatar_url: '/uploads/avatars/luigi.webp',
      });
      expect(item1.tags).toEqual([
        {
          id: 1,
          slug: 'traditional',
          name: 'Traditional',
          resolved_lang: 'en',
        },
      ]);
      expect(item1.available_languages).toEqual(['it', 'en']);

      // Verify recipe 102 (not liked, fallback to source_lang 'it')
      const item2 = result.items[1];
      expect(item2.id).toBe(102);
      expect(item2.title).toBe('Tiramisù Tradizionale');
      expect(item2.resolved_lang).toBe('it');
      expect(item2.is_liked).toBe(false);
      expect(item2.likes_count).toBe(12);
      expect(item2.comments_count).toBe(0);
    });
  });

  describe('getFeed - Localization Fallbacks', () => {
    it('falls back to source_lang, then en, then first translation when requested lang is missing', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
        { requester_id: 1, addressee_id: 3 },
      ]);

      const mockRecipes = [
        {
          id: 201,
          course: Course.first_course,
          difficulty: RecipeDifficulty.easy,
          prep_time: 10,
          cook_time: 10,
          total_time: 20,
          servings: 2,
          source_lang: 'it',
          translation_status: TranslationStatus.completed,
          cover_image_url: null,
          video_url: null,
          created_at: mockDate,
          updated_at: null,
          user: { id: 3, username: 'cook3', avatar_url: null },
          translations: [
            {
              locale: 'en',
              title: 'English Title',
              description: 'English Desc',
            },
          ],
          recipe_tags: [],
          _count: { likes: 0, comments: 0 },
          likes: [],
        },
      ];

      (prisma.recipe.findMany as jest.Mock<any>).mockResolvedValue(mockRecipes);
      (prisma.recipe.count as jest.Mock<any>).mockResolvedValue(1);

      // Caller requested 'fr', which is not available; source_lang 'it' is also not in translations; should fallback to 'en'
      const result = await service.getFeed(1, {
        page: 1,
        limit: 10,
        lang: 'fr',
      });

      expect(result.items[0].title).toBe('English Title');
      expect(result.items[0].resolved_lang).toBe('en');
    });
  });

  describe('getFeed - Pagination Boundaries', () => {
    it('computes pagination metadata correctly for intermediate pages', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
        { requester_id: 1, addressee_id: 2 },
      ]);
      (prisma.recipe.findMany as jest.Mock<any>).mockResolvedValue([]);
      (prisma.recipe.count as jest.Mock<any>).mockResolvedValue(45);

      const result = await service.getFeed(1, { page: 2, limit: 10 });

      expect(prisma.recipe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
      expect(result.total).toBe(45);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total_pages).toBe(5);
      expect(result.has_next_page).toBe(true);
      expect(result.has_prev_page).toBe(true);
    });

    it('sets has_next_page=false and has_prev_page=false when total is 0', async () => {
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValue([
        { requester_id: 1, addressee_id: 2 },
      ]);
      (prisma.recipe.findMany as jest.Mock<any>).mockResolvedValue([]);
      (prisma.recipe.count as jest.Mock<any>).mockResolvedValue(0);

      const result = await service.getFeed(1, { page: 1, limit: 20 });

      expect(result.total).toBe(0);
      expect(result.total_pages).toBe(0);
      expect(result.has_next_page).toBe(false);
      expect(result.has_prev_page).toBe(false);
    });
  });

  describe('getFeed - Unfriend Reactivity', () => {
    it('immediately reflects friendship deletion on the next query', async () => {
      // First call: friendship exists
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValueOnce([
        { requester_id: 1, addressee_id: 2 },
      ]);
      (prisma.recipe.findMany as jest.Mock<any>).mockResolvedValueOnce([]);
      (prisma.recipe.count as jest.Mock<any>).mockResolvedValueOnce(0);

      await service.getFeed(1, { page: 1, limit: 20 });
      expect(prisma.recipe.findMany).toHaveBeenCalledTimes(1);

      // Second call: after unfriending, friendship query returns empty
      (prisma.friendship.findMany as jest.Mock<any>).mockResolvedValueOnce([]);

      const resultAfterUnfriend = await service.getFeed(1, {
        page: 1,
        limit: 20,
      });
      expect(resultAfterUnfriend.items).toEqual([]);
      expect(resultAfterUnfriend.total).toBe(0);
      // Recipe queries were short-circuited and not called again
      expect(prisma.recipe.findMany).toHaveBeenCalledTimes(1);
    });
  });
});
