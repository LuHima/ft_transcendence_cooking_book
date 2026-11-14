import * as crypto from 'crypto';
import { PrismaClient, Role, User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { buildSeedUsers } from '../data/users.data';

export interface ProdAdminBootstrapResult {
  created: boolean;
  username?: string;
}

const DEFAULT_FALLBACK_2FA_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * Encrypts a 2FA secret using AES-256-GCM in the exact `ivHex:authTagHex:cipherHex`
 * format expected by `EncryptionService.decrypting()`.
 */
export function encryptTwoFactorSecret(
  secret: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const keyHex = env.TWO_FACTOR_AUTH?.trim() || DEFAULT_FALLBACK_2FA_KEY;
  const encryptionKey = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
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
  env: NodeJS.ProcessEnv = process.env,
): Promise<Record<string, User>> {
  const fixtures = buildSeedUsers();
  const passwordHash = await bcrypt.hash('Password123', 10);
  const usersByKey: Record<string, User> = {};

  for (const fixture of fixtures) {
    const encryptedTwoFactor = fixture.plainTwoFactorSecret
      ? encryptTwoFactorSecret(fixture.plainTwoFactorSecret, env)
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
