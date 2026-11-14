import * as bcrypt from 'bcrypt';
import { Role, UserStatus } from '@prisma/client';
import { isSeedResetEnabled, resolveSeedEnv } from 'prisma/seed/config';
import { bootstrapProdAdmin } from 'prisma/seed/seeders/users.seeder';

describe('Seed Environment & Production Admin Bootstrap (#198)', () => {
  describe('resolveSeedEnv', () => {
    it('defaults to dev when both DB_SEED_ENV and PRODUCTION_FLAG are unset', () => {
      expect(resolveSeedEnv({})).toBe('dev');
    });

    it('defaults to prod when PRODUCTION_FLAG=true or 1', () => {
      expect(resolveSeedEnv({ PRODUCTION_FLAG: 'true' })).toBe('prod');
      expect(resolveSeedEnv({ PRODUCTION_FLAG: '1' })).toBe('prod');
    });

    it('defaults to dev when PRODUCTION_FLAG=false or 0', () => {
      expect(resolveSeedEnv({ PRODUCTION_FLAG: 'false' })).toBe('dev');
      expect(resolveSeedEnv({ PRODUCTION_FLAG: '0' })).toBe('dev');
    });

    it('allows explicit DB_SEED_ENV=dev override even when PRODUCTION_FLAG=true', () => {
      expect(
        resolveSeedEnv({ PRODUCTION_FLAG: 'true', DB_SEED_ENV: 'dev' }),
      ).toBe('dev');
    });

    it('allows explicit DB_SEED_ENV=prod even when PRODUCTION_FLAG=false', () => {
      expect(
        resolveSeedEnv({ PRODUCTION_FLAG: 'false', DB_SEED_ENV: 'prod' }),
      ).toBe('prod');
    });

    it('throws on invalid DB_SEED_ENV', () => {
      expect(() => resolveSeedEnv({ DB_SEED_ENV: 'staging' })).toThrow(
        /Invalid DB_SEED_ENV/,
      );
    });

    it('throws on invalid PRODUCTION_FLAG', () => {
      expect(() => resolveSeedEnv({ PRODUCTION_FLAG: 'maybe' })).toThrow(
        /Invalid PRODUCTION_FLAG/,
      );
    });
  });

  describe('isSeedResetEnabled', () => {
    it('returns true only for true or 1', () => {
      expect(isSeedResetEnabled({ DB_SEED_RESET: 'true' })).toBe(true);
      expect(isSeedResetEnabled({ DB_SEED_RESET: '1' })).toBe(true);
      expect(isSeedResetEnabled({ DB_SEED_RESET: 'false' })).toBe(false);
      expect(isSeedResetEnabled({})).toBe(false);
    });
  });

  describe('bootstrapProdAdmin', () => {
    const createMockPrisma = (adminCount: number) => ({
      user: {
        count: jest.fn().mockResolvedValue(adminCount),
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    });

    it('skips admin creation when at least 1 admin already exists', async () => {
      const prisma = createMockPrisma(1);
      const result = await bootstrapProdAdmin(prisma as any, {});

      expect(result).toEqual({ created: false });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('fails fast when 0 admins exist and credentials are missing', async () => {
      const prisma = createMockPrisma(0);

      await expect(
        bootstrapProdAdmin(prisma as any, {
          SEED_ADMIN_EMAIL: 'admin@example.com',
        }),
      ).rejects.toThrow(/SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD/);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates initial admin with bcrypt-hashed password when 0 admins exist', async () => {
      const prisma = createMockPrisma(0);

      const result = await bootstrapProdAdmin(prisma as any, {
        SEED_ADMIN_EMAIL: 'admin@wecook.local',
        SEED_ADMIN_USERNAME: 'wecook_admin',
        SEED_ADMIN_PASSWORD: 'SuperSecretProdPassword123!',
      });

      expect(result).toEqual({ created: true, username: 'wecook_admin' });
      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createCalls = prisma.user.create.mock.calls as Array<
        [
          {
            data: {
              email: string;
              username: string;
              role: Role;
              status: UserStatus;
              password_hash: string;
            };
          },
        ]
      >;
      const createArg = createCalls[0][0].data;
      expect(createArg.email).toBe('admin@wecook.local');
      expect(createArg.username).toBe('wecook_admin');
      expect(createArg.role).toBe(Role.admin);
      expect(createArg.status).toBe(UserStatus.active);
      expect(
        await bcrypt.compare(
          'SuperSecretProdPassword123!',
          createArg.password_hash,
        ),
      ).toBe(true);
    });
  });
});
