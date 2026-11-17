import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProfilePrivacy, Role, UserStatus } from '@prisma/client';
import { EncryptionService } from 'src/auth/encryption.service';
import { SEED_COUNTS } from 'prisma/seed/config';
import { buildSeedUsers } from 'prisma/seed/data/users.data';
import {
  encryptTwoFactorSecret,
  seedUsers,
} from 'prisma/seed/seeders/users.seeder';
import { resetDatabaseAndMedia, runSeed } from 'prisma/seed/index';
import * as catalogSeeder from 'prisma/seed/seeders/catalog.seeder';
import * as recipesSeeder from 'prisma/seed/seeders/recipes.seeder';
import * as socialSeeder from 'prisma/seed/seeders/social.seeder';
import * as moderationSeeder from 'prisma/seed/seeders/moderation.seeder';

describe('Users Seeder, 2FA Encryption & Non-Destructive Idempotency (#200)', () => {
  describe('buildSeedUsers', () => {
    const users = buildSeedUsers();

    it('generates 30 unique curated personas covering all roles, statuses, and privacy tiers', () => {
      expect(users.length).toBe(SEED_COUNTS.USERS);
      const emails = new Set(users.map((u) => u.email));
      const usernames = new Set(users.map((u) => u.username));
      expect(emails.size).toBe(SEED_COUNTS.USERS);
      expect(usernames.size).toBe(SEED_COUNTS.USERS);

      for (const u of users) {
        expect(u.username).not.toMatch(/^demo_cook_/);
        expect(`${u.first_name} ${u.last_name}`).not.toMatch(/Chef Demo/);
      }

      expect(users.some((u) => u.role === Role.admin)).toBe(true);
      expect(users.some((u) => u.role === Role.moderator)).toBe(true);
      expect(users.some((u) => u.status === UserStatus.active)).toBe(true);
      expect(users.some((u) => u.status === UserStatus.disabled)).toBe(true);
      expect(users.some((u) => u.status === UserStatus.banned)).toBe(true);
      expect(
        users.some((u) => u.profile_privacy === ProfilePrivacy.public),
      ).toBe(true);
      expect(
        users.some((u) => u.profile_privacy === ProfilePrivacy.friends_only),
      ).toBe(true);
      expect(
        users.some((u) => u.profile_privacy === ProfilePrivacy.private),
      ).toBe(true);
    });

    it('sets deleted_at on luca_disattivato and ex_utente and aligns ban fixtures', () => {
      const luca = users.find((u) => u.key === 'luca_disattivato');
      const ex = users.find((u) => u.key === 'ex_utente');
      const spam = users.find((u) => u.key === 'spam_bot');
      const tempBan = users.find((u) => u.key === 'temp_banned_user');

      expect(luca?.status).toBe(UserStatus.disabled);
      expect(luca?.deleted_at).toBeInstanceOf(Date);
      expect(ex?.status).toBe(UserStatus.disabled);
      expect(ex?.deleted_at).toBeInstanceOf(Date);
      expect(spam?.status).toBe(UserStatus.banned);
      expect(spam?.banned_until).toBeNull();
      expect(tempBan?.status).toBe(UserStatus.banned);
      expect(tempBan?.banned_until!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('encryptTwoFactorSecret', () => {
    it('encrypts alex_secure 2FA secret compatibly with EncryptionService.decrypting', () => {
      const encryptionService = new EncryptionService();
      const encrypted = encryptTwoFactorSecret('JBSWY3DPEHPK3PXP');
      expect(encrypted.split(':')).toHaveLength(3);
      expect(encryptionService.decrypting(encrypted)).toBe('JBSWY3DPEHPK3PXP');
    });
  });

  describe('seedUsers idempotency', () => {
    it('upserts users with update: {} so runtime mutations are never overwritten', async () => {
      const upsert = jest
        .fn()
        .mockImplementation(({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({
            id: 1,
            ...create,
          }),
        );
      const mockPrisma = { user: { upsert } };

      await seedUsers(mockPrisma as never);
      expect(upsert).toHaveBeenCalledTimes(SEED_COUNTS.USERS);
      const calls = upsert.mock.calls as Array<
        [{ update: Record<string, unknown> }]
      >;
      for (const call of calls) {
        expect(call[0].update).toEqual({});
      }
    });
  });

  describe('runSeed non-destructive guard & resetDatabaseAndMedia', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('skips recipes, social, and moderation seeders when seed counts are already satisfied', async () => {
      jest.spyOn(catalogSeeder, 'seedCatalog').mockResolvedValue();
      const recipesSpy = jest
        .spyOn(recipesSeeder, 'seedRecipes')
        .mockResolvedValue({} as never);
      const socialSpy = jest
        .spyOn(socialSeeder, 'seedSocial')
        .mockResolvedValue({} as never);
      const modSpy = jest
        .spyOn(moderationSeeder, 'seedModeration')
        .mockResolvedValue();

      const mockPrisma = {
        user: {
          upsert: jest
            .fn()
            .mockImplementation(
              ({ create }: { create: Record<string, unknown> }) =>
                Promise.resolve({ id: 1, ...create }),
            ),
        },
        recipe: { count: jest.fn().mockResolvedValue(50) },
        friendship: { count: jest.fn().mockResolvedValue(5) },
        report: { count: jest.fn().mockResolvedValue(5) },
      };

      await runSeed(mockPrisma as never, { DB_SEED_ENV: 'dev' });

      expect(recipesSpy).not.toHaveBeenCalled();
      expect(socialSpy).not.toHaveBeenCalled();
      expect(modSpy).not.toHaveBeenCalled();
    });

    it('resets and re-seeds when partial recipe seed state is detected', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wecook-partial-'));
      jest.spyOn(catalogSeeder, 'seedCatalog').mockResolvedValue();
      const recipesSpy = jest
        .spyOn(recipesSeeder, 'seedRecipes')
        .mockResolvedValue({} as never);
      const socialSpy = jest
        .spyOn(socialSeeder, 'seedSocial')
        .mockResolvedValue({} as never);
      const modSpy = jest
        .spyOn(moderationSeeder, 'seedModeration')
        .mockResolvedValue();
      const del = () => ({ deleteMany: jest.fn().mockResolvedValue({ count: 0 }) });

      const mockPrisma = {
        user: {
          upsert: jest
            .fn()
            .mockImplementation(
              ({ create }: { create: Record<string, unknown> }) =>
                Promise.resolve({ id: 1, ...create }),
            ),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        recipe: {
          count: jest.fn().mockResolvedValue(1),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        friendship: {
          count: jest.fn().mockResolvedValue(0),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        report: {
          count: jest.fn().mockResolvedValue(0),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        banHistory: del(),
        userBlock: del(),
        jwtSession: del(),
        notification: del(),
        like: del(),
        comment: del(),
        recipeMedia: del(),
        recipeStepTranslation: del(),
        recipeStep: del(),
        recipeIngredient: del(),
        recipeTag: del(),
        recipeTranslation: del(),
      };

      try {
        await runSeed(mockPrisma as never, {
          DB_SEED_ENV: 'dev',
          UPLOADS_DIR: tmpDir,
        });

        expect(recipesSpy).toHaveBeenCalledTimes(1);
        expect(socialSpy).toHaveBeenCalledTimes(1);
        expect(modSpy).toHaveBeenCalledTimes(1);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('deletes all domain tables in FK order and cleans UPLOADS_DIR/recipes on reset', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wecook-reset-'));
      const recipesDir = path.join(tmpDir, 'recipes');
      fs.mkdirSync(recipesDir, { recursive: true });
      fs.writeFileSync(path.join(recipesDir, 'stale.webp'), 'dummy');

      const order: string[] = [];
      const mkDel = (name: string) => ({
        deleteMany: jest.fn().mockImplementation(() => {
          order.push(name);
          return Promise.resolve({ count: 0 });
        }),
      });

      const mockPrisma = {
        banHistory: mkDel('banHistory'),
        report: mkDel('report'),
        userBlock: mkDel('userBlock'),
        jwtSession: mkDel('jwtSession'),
        notification: mkDel('notification'),
        like: mkDel('like'),
        comment: mkDel('comment'),
        recipeMedia: mkDel('recipeMedia'),
        recipeStepTranslation: mkDel('recipeStepTranslation'),
        recipeStep: mkDel('recipeStep'),
        recipeIngredient: mkDel('recipeIngredient'),
        recipeTag: mkDel('recipeTag'),
        recipeTranslation: mkDel('recipeTranslation'),
        recipe: mkDel('recipe'),
        friendship: mkDel('friendship'),
        user: mkDel('user'),
      };

      await resetDatabaseAndMedia(mockPrisma as any, { UPLOADS_DIR: tmpDir });

      expect(order).toEqual([
        'banHistory',
        'report',
        'userBlock',
        'jwtSession',
        'notification',
        'like',
        'comment',
        'recipeMedia',
        'recipeStepTranslation',
        'recipeStep',
        'recipeIngredient',
        'recipeTag',
        'recipeTranslation',
        'recipe',
        'friendship',
        'user',
      ]);
      expect(fs.existsSync(recipesDir)).toBe(false);
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
