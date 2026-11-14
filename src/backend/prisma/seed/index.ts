import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { resolveSeedEnv } from './config';
import { seedCatalog } from './seeders/catalog.seeder';
import { bootstrapProdAdmin, seedUsers } from './seeders/users.seeder';
import { seedRecipes } from './seeders/recipes.seeder';
import { seedSocial } from './seeders/social.seeder';
import { seedModeration } from './seeders/moderation.seeder';

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

  await seedUsers(prisma);
  await seedRecipes(prisma);
  await seedSocial(prisma);
  await seedModeration(prisma);
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
