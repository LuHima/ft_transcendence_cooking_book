import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import {
  isSeedResetEnabled,
  resolveSeedEnv,
  resolveSeedUploadsDir,
  SEED_COUNTS,
} from './config';
import { seedCatalog } from './seeders/catalog.seeder';
import { bootstrapProdAdmin, seedUsers } from './seeders/users.seeder';
import { seedRecipes } from './seeders/recipes.seeder';
import { seedSocial } from './seeders/social.seeder';
import { seedModeration } from './seeders/moderation.seeder';

/**
 * Deletes all domain tables in strict foreign-key order (including polymorphic
 * `reports`, `ban_history`, `user_blocks`, `jwt_sessions`, and `users`) and
 * removes previously seeded recipe media files in `UPLOADS_DIR/recipes`.
 */
export async function resetDatabaseAndMedia(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  console.log('[seed:reset] Wiping domain tables in FK order...');
  await prisma.banHistory.deleteMany();
  await prisma.report.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.jwtSession.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.recipeMedia.deleteMany();
  await prisma.recipeStepTranslation.deleteMany();
  await prisma.recipeStep.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipeTag.deleteMany();
  await prisma.recipeTranslation.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.user.deleteMany();

  const recipeUploadsDir = path.join(resolveSeedUploadsDir(env), 'recipes');
  if (fs.existsSync(recipeUploadsDir)) {
    fs.rmSync(recipeUploadsDir, { recursive: true, force: true });
    console.log(
      `[seed:reset] Cleaned seeded media directory: ${recipeUploadsDir}`,
    );
  }
}

export async function runSeed(
  prisma: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const mode = resolveSeedEnv(env);
  console.log(`[seed] Running database seed in "${mode}" mode...`);

  await seedCatalog(prisma);

  if (mode === 'prod') {
    await bootstrapProdAdmin(prisma, env);
    console.log('[seed] Production seed completed.');
    return;
  }

  if (isSeedResetEnabled(env)) {
    await resetDatabaseAndMedia(prisma, env);
  }

  let usersByKey = await seedUsers(prisma);

  const existingRecipes = await prisma.recipe.count();
  if (existingRecipes > 0) {
    const [existingFriendships, existingReports] = await Promise.all([
      prisma.friendship.count(),
      prisma.report.count(),
    ]);
    if (
      existingRecipes >= SEED_COUNTS.TOTAL_RECIPES &&
      (existingFriendships > 0 || existingReports > 0)
    ) {
      console.log(
        `[seed] Demo recipes already exist (${existingRecipes} found); skipping recipes, social, and moderation seeders.`,
      );
      return;
    }

    console.warn(
      `[seed] Partial seed state detected (recipes=${existingRecipes}, friendships=${existingFriendships}, reports=${existingReports}); resetting domain tables before resuming seed.`,
    );
    await resetDatabaseAndMedia(prisma, env);
    usersByKey = await seedUsers(prisma);
  }

  const recipesResult = await seedRecipes(prisma, usersByKey, env);
  const socialResult = await seedSocial(prisma, usersByKey, recipesResult);
  await seedModeration(prisma, usersByKey, recipesResult, socialResult);
  console.log('[seed] Development seed completed.');
}

async function main(): Promise<void> {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL ?? '',
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await runSeed(prisma, process.env);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  });
}
