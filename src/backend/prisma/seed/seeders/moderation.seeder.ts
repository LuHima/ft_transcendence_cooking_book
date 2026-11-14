import {
  PrismaClient,
  RecipePrivacy,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportSubject,
  User,
} from '@prisma/client';
import type { SeedRecipesResult } from './recipes.seeder';
import type { SeedSocialResult } from './social.seeder';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seeds ~18+ `Report` rows across all subjects (`recipe`, `comment`, `user`)
 * and statuses (`pending`, `dismissed`, `action_taken`), plus progressive
 * `BanHistory` chains aligned with `spam_bot` and repeat-offender users.
 */
export async function seedModeration(
  prisma: PrismaClient,
  usersByKey: Record<string, User>,
  recipes: SeedRecipesResult,
  social: SeedSocialResult,
  now: Date = new Date(),
): Promise<void> {
  const mario = usersByKey['mario_bianchi'];
  const giulia = usersByKey['giuly_cooks'];
  const marco = usersByKey['chef_marco'];
  const sophie = usersByKey['sophie_pastry'];
  const kenji = usersByKey['kenji_noodles'];
  const elena = usersByKey['elena_vegan'];
  const modSarah = usersByKey['sarah_mod'];
  const adminMarghe = usersByKey['marghe_admin'];
  const spamBot = usersByKey['spam_bot'];
  const tempBanned = usersByKey['temp_banned_user'];
  const repeatActive = usersByKey['repeat_offender_active'];

  const privateRecipe =
    recipes.all.find((r) => r.privacy === RecipePrivacy.private) ??
    recipes.byKey['gnocchi'];
  const suspendedRecipes = recipes.all.filter((r) => !r.is_active);
  const publicRecipe = recipes.byKey['carbonara'];

  // 1. Reports (~18+)
  const spamUserReport = await prisma.report.create({
    data: {
      reporter_id: mario.id,
      subject: ReportSubject.user,
      target_id: spamBot.id,
      reason: ReportReason.spam_scam,
      description: 'Automated crypto spam links posted across recipe threads.',
      status: ReportStatus.action_taken,
      actions: [ReportAction.ban],
      resolution_reason: ReportReason.spam_scam,
      resolution_description: 'Permanent ban issued for automated spam.',
      resolved_by_id: modSarah.id,
      resolved_at: new Date(now.getTime() - 20 * DAY_MS),
    },
  });

  await prisma.report.create({
    data: {
      reporter_id: giulia.id,
      subject: ReportSubject.comment,
      target_id: social.spamCommentId,
      reason: ReportReason.spam_scam,
      description: 'Spam comment with phishing URL.',
      status: ReportStatus.action_taken,
      actions: [ReportAction.delete_content],
      resolution_reason: ReportReason.spam_scam,
      resolution_description: 'Comment deactivated and author banned.',
      resolved_by_id: modSarah.id,
      resolved_at: new Date(now.getTime() - 20 * DAY_MS),
    },
  });

  // 3+ pending reports on one comment (Reported Comments Audit Filter)
  const multiCommentReporters = [mario, giulia, marco, sophie];
  for (let i = 0; i < multiCommentReporters.length; i++) {
    await prisma.report.create({
      data: {
        reporter_id: multiCommentReporters[i].id,
        subject: ReportSubject.comment,
        target_id: social.multiReportedCommentId,
        reason: ReportReason.harassment_bullying,
        description: `Community report #${i + 1}: aggressive off-topic comment.`,
        status: ReportStatus.pending,
      },
    });
  }

  // Active pending report targeting a private recipe (Audited Private Inspection)
  await prisma.report.create({
    data: {
      reporter_id: kenji.id,
      subject: ReportSubject.recipe,
      target_id: privateRecipe.id,
      reason: ReportReason.copyright_infringement,
      description:
        'Pending report on a private recipe to enable Audited Private Inspection.',
      status: ReportStatus.pending,
    },
  });

  // Resolved reports on suspended recipes
  for (let i = 0; i < suspendedRecipes.length; i++) {
    await prisma.report.create({
      data: {
        reporter_id: elena.id,
        subject: ReportSubject.recipe,
        target_id: suspendedRecipes[i].id,
        reason: ReportReason.impersonation_misinformation,
        description: 'Unsafe preparation instructions reported for review.',
        status: ReportStatus.action_taken,
        actions: [ReportAction.delete_content],
        resolution_reason: ReportReason.impersonation_misinformation,
        resolution_description: 'Recipe suspended pending author revision.',
        resolved_by_id: modSarah.id,
        resolved_at: new Date(now.getTime() - (10 + i) * DAY_MS),
      },
    });
  }

  // Additional reports across subjects & statuses to reach 18+
  const extraReports = [
    {
      reporter_id: mario.id,
      subject: ReportSubject.recipe,
      target_id: publicRecipe.id,
      reason: ReportReason.other,
      description: 'False alarm: ingredient note clarification.',
      status: ReportStatus.dismissed,
      actions: [ReportAction.dismiss],
      resolution_reason: ReportReason.other,
      resolution_description: 'Reviewed and found compliant.',
      resolved_by_id: modSarah.id,
      resolved_at: new Date(now.getTime() - 12 * DAY_MS),
    },
    {
      reporter_id: sophie.id,
      subject: ReportSubject.user,
      target_id: tempBanned.id,
      reason: ReportReason.harassment_bullying,
      description: 'Repeated abusive messages.',
      status: ReportStatus.action_taken,
      actions: [ReportAction.ban],
      resolution_reason: ReportReason.harassment_bullying,
      resolution_description: '30-day temporary suspension applied.',
      resolved_by_id: modSarah.id,
      resolved_at: now,
    },
    {
      reporter_id: marco.id,
      subject: ReportSubject.user,
      target_id: repeatActive.id,
      reason: ReportReason.harassment_bullying,
      description: 'Unkind remarks on beginner recipe.',
      status: ReportStatus.action_taken,
      actions: [ReportAction.warn],
      resolution_reason: ReportReason.harassment_bullying,
      resolution_description: 'Formal warning issued.',
      resolved_by_id: modSarah.id,
      resolved_at: new Date(now.getTime() - 3 * DAY_MS),
    },
    {
      reporter_id: kenji.id,
      subject: ReportSubject.user,
      target_id: usersByKey['hannah_fischer'].id,
      reason: ReportReason.spam_scam,
      description: 'Suspicious external link in bio.',
      status: ReportStatus.pending,
    },
    {
      reporter_id: elena.id,
      subject: ReportSubject.user,
      target_id: usersByKey['tiago_silva'].id,
      reason: ReportReason.impersonation_misinformation,
      description: 'Possible duplicate account.',
      status: ReportStatus.dismissed,
      actions: [ReportAction.dismiss],
      resolution_reason: ReportReason.other,
      resolution_description: 'Verified distinct user.',
      resolved_by_id: adminMarghe.id,
      resolved_at: new Date(now.getTime() - 8 * DAY_MS),
    },
    {
      reporter_id: giulia.id,
      subject: ReportSubject.recipe,
      target_id: recipes.byKey['risotto'].id,
      reason: ReportReason.other,
      description: 'Duplicate submission check.',
      status: ReportStatus.dismissed,
      actions: [ReportAction.dismiss],
      resolution_reason: ReportReason.other,
      resolution_description: 'Distinct regional variation.',
      resolved_by_id: modSarah.id,
      resolved_at: new Date(now.getTime() - 6 * DAY_MS),
    },
    {
      reporter_id: mario.id,
      subject: ReportSubject.recipe,
      target_id: recipes.byKey['guacamole'].id,
      reason: ReportReason.copyright_infringement,
      description: 'Needs attribution check.',
      status: ReportStatus.pending,
    },
    {
      reporter_id: marco.id,
      subject: ReportSubject.comment,
      target_id: social.offTopicCommentId,
      reason: ReportReason.other,
      description: 'Off-topic question.',
      status: ReportStatus.dismissed,
      actions: [ReportAction.dismiss],
      resolution_reason: ReportReason.other,
      resolution_description: 'Benign community question.',
      resolved_by_id: modSarah.id,
      resolved_at: new Date(now.getTime() - 4 * DAY_MS),
    },
    {
      reporter_id: sophie.id,
      subject: ReportSubject.comment,
      target_id: social.hateSpeechPendingCommentId,
      reason: ReportReason.hate_speech,
      description: 'Pending moderator review.',
      status: ReportStatus.pending,
    },
    {
      reporter_id: elena.id,
      subject: ReportSubject.comment,
      target_id: social.promoSpamPendingCommentId,
      reason: ReportReason.spam_scam,
      description: 'Promotional coupon code in comment.',
      status: ReportStatus.pending,
    },
  ];

  for (const r of extraReports) {
    await prisma.report.create({ data: r });
  }

  // 2. Ban History aligned with user moderation states
  // 2a. spam_bot: permanent ban matching status=banned, banned_until=null
  await prisma.banHistory.create({
    data: {
      user_id: spamBot.id,
      banned_by_id: modSarah.id,
      report_id: spamUserReport.id,
      action: ReportAction.ban,
      reason: ReportReason.spam_scam,
      description: 'Permanent ban for automated spam.',
      duration_days: null,
      is_permanent: true,
      banned_at: new Date(now.getTime() - 20 * DAY_MS),
      expires_at: null,
      unbanned_at: null,
    },
  });

  // 2b. temp_banned_user: warn -> manual unban -> expired temp ban -> active 30-day ban
  await prisma.banHistory.createMany({
    data: [
      {
        user_id: tempBanned.id,
        banned_by_id: modSarah.id,
        action: ReportAction.warn,
        reason: ReportReason.harassment_bullying,
        description: 'Initial warning for aggressive comments.',
        duration_days: null,
        is_permanent: false,
        banned_at: new Date(now.getTime() - 90 * DAY_MS),
      },
      {
        user_id: tempBanned.id,
        banned_by_id: modSarah.id,
        action: ReportAction.ban,
        reason: ReportReason.harassment_bullying,
        description: '7-day suspension after repeated offenses.',
        duration_days: 7,
        is_permanent: false,
        banned_at: new Date(now.getTime() - 60 * DAY_MS),
        expires_at: new Date(now.getTime() - 53 * DAY_MS),
        unbanned_at: new Date(now.getTime() - 58 * DAY_MS),
        unbanned_by_id: adminMarghe.id,
        unban_reason: 'Appeal accepted after apology.',
      },
      {
        user_id: tempBanned.id,
        banned_by_id: modSarah.id,
        action: ReportAction.ban,
        reason: ReportReason.harassment_bullying,
        description: '14-day suspension for continued harassment.',
        duration_days: 14,
        is_permanent: false,
        banned_at: new Date(now.getTime() - 40 * DAY_MS),
        expires_at: new Date(now.getTime() - 26 * DAY_MS),
      },
      {
        user_id: tempBanned.id,
        banned_by_id: modSarah.id,
        action: ReportAction.ban,
        reason: ReportReason.harassment_bullying,
        description: 'Active 30-day progressive suspension.',
        duration_days: 30,
        is_permanent: false,
        banned_at: now,
        expires_at: tempBanned.banned_until,
      },
    ],
  });

  // 2c. repeat_offender_active: historical warn + expired ban (currently active)
  await prisma.banHistory.createMany({
    data: [
      {
        user_id: repeatActive.id,
        banned_by_id: modSarah.id,
        action: ReportAction.warn,
        reason: ReportReason.harassment_bullying,
        description: 'Warning for off-topic hostility.',
        duration_days: null,
        is_permanent: false,
        banned_at: new Date(now.getTime() - 50 * DAY_MS),
      },
      {
        user_id: repeatActive.id,
        banned_by_id: modSarah.id,
        action: ReportAction.ban,
        reason: ReportReason.harassment_bullying,
        description: 'Expired 7-day temporary ban.',
        duration_days: 7,
        is_permanent: false,
        banned_at: new Date(now.getTime() - 30 * DAY_MS),
        expires_at: new Date(now.getTime() - 23 * DAY_MS),
      },
    ],
  });

  console.log(
    `[seed:moderation] Seeded ${9 + extraReports.length} reports and progressive BanHistory chains.`,
  );
}
