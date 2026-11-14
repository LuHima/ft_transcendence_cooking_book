import { PrismaClient, Role, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EncryptionService } from '../../../src/auth/encryption.service';
import { buildSeedUsers } from '../data/users.data';

export interface ProdAdminBootstrapResult {
  created: boolean;
  username?: string;
}

/**
 * Encrypts a 2FA secret using the backend's `EncryptionService` so seeded
 * secrets match runtime decryption byte-for-byte.
 */
export function encryptTwoFactorSecret(secret: string): string {
  const encryptionService = new EncryptionService();
  return encryptionService.encrypting(secret);
}

/**
 * Bootstraps the initial production admin only when zero admin accounts exist.
 * Fails fast if any required `SEED_ADMIN_*` credential is missing.
 */
export async function bootstrapProdAdmin(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ProdAdminBootstrapResult> {
  const existingAdmins = await prisma.user.count({
    where: { role: Role.admin },
  });

  if (existingAdmins >= 1) {
    console.log(
      `[seed:prod] Admin account already exists (${existingAdmins} found); skipping initial admin creation.`,
    );
    return { created: false };
  }

  const email = env.SEED_ADMIN_EMAIL?.trim() ?? '';
  const username = env.SEED_ADMIN_USERNAME?.trim() ?? '';
  const password = env.SEED_ADMIN_PASSWORD?.trim() ?? '';

  const missing: string[] = [];
  if (!email) missing.push('SEED_ADMIN_EMAIL');
  if (!username) missing.push('SEED_ADMIN_USERNAME');
  if (!password) missing.push('SEED_ADMIN_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Cannot bootstrap initial production admin: missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  const password_hash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      username,
      password_hash,
      role: Role.admin,
      status: UserStatus.active,
    },
  });

  console.log(`[seed:prod] Created initial admin user "${username}".`);
  return { created: true, username };
}

/**
 * Non-destructively upserts the ~30 deterministic development users (`update: {}`)
 * so runtime profile edits, password resets, or 2FA state changes are preserved.
 */
export async function seedUsers(
  prisma: PrismaClient,
): Promise<Record<string, User>> {
  const fixtures = buildSeedUsers();
  const passwordHash = await bcrypt.hash('Password123', 10);
  const usersByKey: Record<string, User> = {};

  for (const fixture of fixtures) {
    const encryptedTwoFactor = fixture.plainTwoFactorSecret
      ? encryptTwoFactorSecret(fixture.plainTwoFactorSecret)
      : null;

    const user = await prisma.user.upsert({
      where: { email: fixture.email },
      update: {},
      create: {
        username: fixture.username,
        email: fixture.email,
        password_hash: passwordHash,
        first_name: fixture.first_name,
        last_name: fixture.last_name,
        role: fixture.role,
        status: fixture.status,
        profile_privacy: fixture.profile_privacy,
        bio: fixture.bio,
        city: fixture.city,
        birth_date: fixture.birth_date,
        avatar_url: fixture.avatar_url,
        is_two_factor_enabled: fixture.is_two_factor_enabled ?? false,
        two_factor: encryptedTwoFactor,
        banned_until: fixture.banned_until ?? null,
        deleted_at: fixture.deleted_at ?? null,
      },
    });

    usersByKey[fixture.key] = user;
  }

  console.log(`[seed:users] Ensured ${fixtures.length} development users.`);
  return usersByKey;
}
