import { PrismaClient, Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export interface ProdAdminBootstrapResult {
  created: boolean;
  username?: string;
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
 * Seeds development users (expanded in #200).
 */
export async function seedUsers(_prisma: PrismaClient): Promise<void> {
  console.log('[seed:users] Development users seeder placeholder.');
}
