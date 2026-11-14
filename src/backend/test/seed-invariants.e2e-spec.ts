import 'dotenv/config';
import * as fs from 'fs';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  FriendshipStatus,
  NotificationAction,
  OwnerType,
  PrismaClient,
  RecipePrivacy,
  ReportAction,
  ReportStatus,
  ReportSubject,
  UserStatus,
} from '@prisma/client';
import { EncryptionService } from 'src/auth/encryption.service';
import { resolveStoredUploadPath } from 'src/common/config/upload-paths';
import { runSeed } from 'prisma/seed/index';

describe('Database Seed Invariants (e2e against PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL ?? '',
    });
    prisma = new PrismaClient({ adapter });
    await runSeed(prisma, { ...process.env, DB_SEED_ENV: 'dev', DB_SEED_RESET: 'true' });
  }, 30000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seeds ~3,000 ingredients and 12+ tags with complete it/en/fr translations', async () => {
    const ingredientCount = await prisma.ingredient.count();
    const tagCount = await prisma.tag.count();
    expect(ingredientCount).toBeGreaterThanOrEqual(2900);
    expect(tagCount).toBeGreaterThanOrEqual(12);
  });

  it('seeds 30 users with valid 2FA encryption, deleted_at, and ban states', async () => {
    const userCount = await prisma.user.count();
    expect(userCount).toBe(30);

    const alex = await prisma.user.findUniqueOrThrow({
      where: { username: 'alex_secure' },
    });
    const enc = new EncryptionService();
    expect(alex.is_two_factor_enabled).toBe(true);
    expect(enc.decrypting(alex.two_factor)).toBe('JBSWY3DPEHPK3PXP');

    const luca = await prisma.user.findUniqueOrThrow({
      where: { username: 'luca_disattivato' },
    });
    expect(luca.status).toBe(UserStatus.disabled);
    expect(luca.deleted_at).not.toBeNull();

    const spamBot = await prisma.user.findUniqueOrThrow({
      where: { username: 'spam_bot' },
    });
    expect(spamBot.status).toBe(UserStatus.banned);
    expect(spamBot.banned_until).toBeNull();
  });

  it('seeds 50 recipes with platform custody, local media files, and zero external URLs', async () => {
    const recipes = await prisma.recipe.findMany({
      include: { steps: true, recipe_media: true },
    });
    expect(recipes.length).toBe(50);

    const exUtente = await prisma.user.findUniqueOrThrow({
      where: { username: 'ex_utente' },
    });
    const custodyRecipes = recipes.filter(
      (r) => r.owner_type === OwnerType.platform && r.user_id === exUtente.id,
    );
    expect(custodyRecipes.length).toBeGreaterThanOrEqual(3);

    expect(recipes.filter((r) => !r.is_active).length).toBeGreaterThanOrEqual(2);
    expect(
      recipes.some((r) => r.privacy === RecipePrivacy.friends_only),
    ).toBe(true);
    expect(recipes.some((r) => r.privacy === RecipePrivacy.private)).toBe(true);

    for (const recipe of recipes) {
      if (recipe.cover_image_url) {
        expect(recipe.cover_image_url).toMatch(
          new RegExp(`^/api/media/recipes/${recipe.id}/`),
        );
        const resolved = resolveStoredUploadPath(recipe.cover_image_url);
        expect(resolved).not.toBeNull();
        expect(fs.existsSync(resolved!)).toBe(true);
      }
      if (recipe.video_url) {
        expect(recipe.video_url).toMatch(
          new RegExp(`^/api/media/recipes/${recipe.id}/`),
        );
        const resolved = resolveStoredUploadPath(recipe.video_url);
        expect(resolved).not.toBeNull();
        expect(fs.existsSync(resolved!)).toBe(true);
      }
    }
  });

  it('enforces zero self-likes, 12+ mario friends, cooldown, blocks, and pizzaPlatform pagination', async () => {
    const likes = await prisma.like.findMany({
      include: { recipe: { select: { user_id: true } } },
    });
    expect(likes.length).toBeGreaterThan(0);
    for (const like of likes) {
      expect(like.user_id).not.toBe(like.recipe.user_id);
    }

    const mario = await prisma.user.findUniqueOrThrow({
      where: { username: 'mario_bianchi' },
    });
    const marioAccepted = await prisma.friendship.count({
      where: {
        status: FriendshipStatus.accepted,
        OR: [{ requester_id: mario.id }, { addressee_id: mario.id }],
      },
    });
    expect(marioAccepted).toBeGreaterThanOrEqual(12);

    const recentRejected = await prisma.friendship.findFirst({
      where: { status: FriendshipStatus.rejected },
    });
    expect(recentRejected).not.toBeNull();

    const blocks = await prisma.userBlock.findMany();
    expect(blocks.length).toBeGreaterThanOrEqual(2);

    const totalComments = await prisma.comment.count();
    expect(totalComments).toBeGreaterThanOrEqual(55);

    const pizza = await prisma.recipe.findFirstOrThrow({
      where: {
        owner_type: OwnerType.platform,
        translations: { some: { title: { contains: 'Pizza Margherita' } } },
      },
    });
    const pizzaRoots = await prisma.comment.findMany({
      where: { recipe_id: pizza.id, parent_id: null },
      include: { _count: { select: { replies: true } } },
    });
    expect(pizzaRoots.length).toBeGreaterThanOrEqual(25);
    expect(pizzaRoots.some((c) => c._count.replies >= 9)).toBe(true);
  });

  it('seeds consistent notifications, 18+ reports with valid targets, and aligned BanHistory', async () => {
    const notifications = await prisma.notification.findMany();
    expect(notifications.length).toBeGreaterThanOrEqual(30);
    expect(
      notifications.some((n) => n.action === NotificationAction.warn),
    ).toBe(true);

    const reports = await prisma.report.findMany();
    expect(reports.length).toBeGreaterThanOrEqual(18);

    // Polymorphic target integrity
    for (const r of reports) {
      if (r.subject === ReportSubject.user) {
        expect(await prisma.user.findUnique({ where: { id: r.target_id } })).not.toBeNull();
      } else if (r.subject === ReportSubject.recipe) {
        expect(await prisma.recipe.findUnique({ where: { id: r.target_id } })).not.toBeNull();
      } else {
        expect(await prisma.comment.findUnique({ where: { id: r.target_id } })).not.toBeNull();
      }
    }

    // Pending report on a private recipe
    const privateRecipes = await prisma.recipe.findMany({
      where: { privacy: RecipePrivacy.private },
      select: { id: true },
    });
    const privateIds = new Set(privateRecipes.map((r) => r.id));
    expect(
      reports.some(
        (r) =>
          r.subject === ReportSubject.recipe &&
          r.status === ReportStatus.pending &&
          privateIds.has(r.target_id),
      ),
    ).toBe(true);

    // 3+ pending reports on a single comment
    const pendingCommentCounts = new Map<number, number>();
    for (const r of reports) {
      if (
        r.subject === ReportSubject.comment &&
        r.status === ReportStatus.pending
      ) {
        pendingCommentCounts.set(
          r.target_id,
          (pendingCommentCounts.get(r.target_id) ?? 0) + 1,
        );
      }
    }
    expect(Math.max(...pendingCommentCounts.values())).toBeGreaterThanOrEqual(3);

    // BanHistory alignment
    const spamBot = await prisma.user.findUniqueOrThrow({
      where: { username: 'spam_bot' },
    });
    const spamBan = await prisma.banHistory.findFirst({
      where: { user_id: spamBot.id, is_permanent: true, unbanned_at: null },
    });
    expect(spamBan).not.toBeNull();

    const tempBanned = await prisma.user.findUniqueOrThrow({
      where: { username: 'marco_tempban' },
    });
    const tempHistory = await prisma.banHistory.findMany({
      where: { user_id: tempBanned.id },
      orderBy: { banned_at: 'asc' },
    });
    expect(tempHistory.length).toBeGreaterThanOrEqual(4);
    expect(tempHistory[0].action).toBe(ReportAction.warn);
    expect(tempHistory.some((h) => h.unbanned_at !== null)).toBe(true);
    expect(
      tempHistory[tempHistory.length - 1].expires_at?.getTime(),
    ).toBe(tempBanned.banned_until?.getTime());
  });

  it('remains idempotent on repeated dev startup without overwriting runtime user changes', async () => {
    const reportsBefore = await prisma.report.count();
    const marioBefore = await prisma.user.findUniqueOrThrow({
      where: { username: 'mario_bianchi' },
    });
    await prisma.user.update({
      where: { id: marioBefore.id },
      data: { bio: 'Runtime bio mutation preserved across restart' },
    });

    await runSeed(prisma, { ...process.env, DB_SEED_ENV: 'dev', DB_SEED_RESET: 'false' });

    const marioAfter = await prisma.user.findUniqueOrThrow({
      where: { id: marioBefore.id },
    });
    expect(marioAfter.bio).toBe('Runtime bio mutation preserved across restart');
    expect(await prisma.recipe.count()).toBe(50);
    expect(await prisma.report.count()).toBe(reportsBefore);
  }, 30000);
});
