import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ImageProcessingService } from '../common/services/image-processing.service';
import { RecipeProjection } from '../recipe/recipe.projection';
import { BanHistoryService } from '../reports/ban-history.service';
import {
  Course,
  OwnerType,
  RecipeDifficulty,
  Role,
  TranslationStatus,
  UserStatus,
} from '@prisma/client';

describe('Admin User Governance & Content Lifecycle Integration Suite', () => {
  let adminService: AdminService;
  let projection: RecipeProjection;

  // In-memory relational state mock to simulate full roundtrip persistence
  let dbUser: any;
  let dbRecipe: any;
  let dbComments: any[];
  let dbSessions: any[];

  beforeEach(async () => {
    dbUser = {
      id: 42,
      username: 'chef_mario',
      email: 'mario@wecook.com',
      role: Role.user,
      status: UserStatus.active,
      password_hash: 'hashed',
      avatar_url: '/uploads/avatars/mario.webp',
      created_at: new Date('2026-01-01'),
      deleted_at: null,
      _count: { recipes: 1 },
    };

    dbRecipe = {
      id: 101,
      user_id: 42,
      owner_type: OwnerType.user,
      course: Course.first_course,
      difficulty: RecipeDifficulty.medium,
      prep_time: 15,
      cook_time: 20,
      total_time: 35,
      servings: 4,
      source_lang: 'it',
      translation_status: TranslationStatus.completed,
      cover_image_url: '/uploads/recipes/carbonara.webp',
      video_url: null,
      created_at: new Date('2026-01-05'),
      updated_at: null,
      user: {
        id: 42,
        username: 'chef_mario',
        avatar_url: '/uploads/avatars/mario.webp',
      },
      translations: [
        {
          locale: 'it',
          title: 'Spaghetti alla Carbonara',
          description: 'Classica',
        },
      ],
      recipe_tags: [],
      _count: { likes: 10, comments: 1 },
      likes: [],
    };

    dbComments = [
      {
        id: 501,
        recipe_id: 202,
        user_id: 42,
        content: 'Ottima ricetta!',
        is_active: true,
      },
    ];

    dbSessions = [
      {
        id_session: 1,
        id_user: 42,
        hashed_jwt_token: 'session_token',
        expire_time_jwt: new Date(Date.now() + 600000),
      },
    ];

    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === dbUser.id) return Promise.resolve({ ...dbUser });
          if (where.id === 1) {
            return Promise.resolve({
              id: 1,
              role: Role.admin,
              status: UserStatus.active,
            });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }) => {
          if (where.id === dbUser.id) {
            dbUser = { ...dbUser, ...data };
            return Promise.resolve({ ...dbUser });
          }
          return Promise.resolve(null);
        }),
        count: jest.fn().mockResolvedValue(2),
      },
      recipe: {
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          if (where.user_id === dbRecipe.user_id) {
            dbRecipe = { ...dbRecipe, ...data };
          }
          return Promise.resolve({ count: 1 });
        }),
      },
      comment: {
        updateMany: jest.fn().mockImplementation(({ where, data }) => {
          dbComments = dbComments.map((c) =>
            c.user_id === where.user_id ? { ...c, ...data } : c,
          );
          return Promise.resolve({ count: dbComments.length });
        }),
      },
      jwtSession: {
        deleteMany: jest.fn().mockImplementation(({ where }) => {
          dbSessions = dbSessions.filter((s) => s.id_user !== where.id_user);
          return Promise.resolve({ count: 1 });
        }),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    const mockImageProcessing = {
      processAvatarFile: jest.fn(),
    };

    const mockBanHistoryService = {
      recordSanction: jest.fn().mockResolvedValue({ id: 'ban-1' }),
      recordUnban: jest.fn().mockResolvedValue({ id: 'ban-1' }),
      getPreviousBansCount: jest.fn().mockResolvedValue(0),
      getUserSanctionsHistory: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        RecipeProjection,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ImageProcessingService, useValue: mockImageProcessing },
        { provide: BanHistoryService, useValue: mockBanHistoryService },
      ],
    }).compile();

    adminService = module.get<AdminService>(AdminService);
    projection = module.get<RecipeProjection>(RecipeProjection);
  });

  it('executes full roundtrip: Active -> Soft-Delete (Platform Custody) -> Reactivate (Content Restoration)', async () => {
    // ── STEP 1: INITIAL ACTIVE STATE ──
    expect(dbUser.status).toBe(UserStatus.active);
    expect(dbRecipe.owner_type).toBe(OwnerType.user);
    expect(dbComments[0].is_active).toBe(true);
    expect(dbSessions).toHaveLength(1);

    // Initial recipe projection should include author metadata
    const initialProjection = projection.toLocalizedSummary(
      dbRecipe,
      'it',
      undefined,
    );
    expect(initialProjection.author).not.toBeNull();
    expect(initialProjection.author?.username).toBe('chef_mario');

    // ── STEP 2: SOFT DELETION BY ADMINISTRATOR ──
    const deleteResult = await adminService.deleteUser(42, 1, false);
    expect(deleteResult.message).toBe('User deactivated successfully');

    // Account is disabled, deletion timestamp recorded, sessions evicted
    expect(dbUser.status).toBe(UserStatus.disabled);
    expect(dbUser.deleted_at).toBeInstanceOf(Date);
    expect(dbSessions).toHaveLength(0);

    // Authored recipes adopted into platform custody (retaining user_id)
    expect(dbRecipe.owner_type).toBe(OwnerType.platform);
    expect(dbRecipe.user_id).toBe(42);

    // Comments are non-destructively deactivated
    expect(dbComments[0].is_active).toBe(false);

    // ── STEP 3: NETWORK ISOLATION VERIFICATION ──
    // Projection over HTTP wire strictly yields author: null for platform-custody content
    const isolatedProjection = projection.toLocalizedSummary(
      dbRecipe,
      'it',
      undefined,
    );
    expect(isolatedProjection.author).toBeNull();

    const isolatedDetail = projection.toLocalizedDetail(
      {
        ...dbRecipe,
        steps: [],
        recipe_ingredients: [],
        recipe_media: [],
      },
      'it',
      undefined,
    );
    expect(isolatedDetail.author).toBeNull();

    // ── STEP 4: ATOMIC USER REACTIVATION ──
    const reactivateResult = await adminService.updateUser(
      42,
      { status: UserStatus.active },
      1,
    );
    expect(reactivateResult.status).toBe(UserStatus.active);
    expect(reactivateResult.deleted_at).toBeNull();

    // Reverted platform recipes back to author ownership
    expect(dbRecipe.owner_type).toBe(OwnerType.user);

    // Restored authored comments back to active
    expect(dbComments[0].is_active).toBe(true);

    // ── STEP 5: POST-RESTORATION PROJECTION VERIFICATION ──
    // Projection once again presents author attribution
    const restoredProjection = projection.toLocalizedSummary(
      dbRecipe,
      'it',
      undefined,
    );
    expect(restoredProjection.author).not.toBeNull();
    expect(restoredProjection.author?.username).toBe('chef_mario');
    expect(restoredProjection.author?.avatar_url).toBe(
      '/uploads/avatars/mario.webp',
    );
  });
});
