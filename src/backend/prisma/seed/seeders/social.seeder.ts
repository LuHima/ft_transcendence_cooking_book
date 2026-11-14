import {
  FriendshipStatus,
  NotificationAction,
  NotificationSubject,
  PrismaClient,
  RecipePrivacy,
  User,
} from '@prisma/client';
import type { SeedRecipesResult } from './recipes.seeder';

export interface SeedSocialResult {
  spamCommentId: number;
  exUtenteCommentId: number;
  multiReportedCommentId: number;
  allCommentIds: number[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seeds friendships (12+ accepted for mario_bianchi, pending, and recent rejected
 * cooldown), user blocks, ~55+ comments (25+ roots on pizzaPlatform + 9-reply
 * thread), zero-self-like recipe likes, and ~30+ consistent notifications.
 */
export async function seedSocial(
  prisma: PrismaClient,
  usersByKey: Record<string, User>,
  recipes: SeedRecipesResult,
  now: Date = new Date(),
): Promise<SeedSocialResult> {
  const mario = usersByKey['mario_bianchi'];
  const giulia = usersByKey['giuly_cooks'];
  const marco = usersByKey['chef_marco'];
  const sophie = usersByKey['sophie_pastry'];
  const kenji = usersByKey['kenji_noodles'];
  const elena = usersByKey['elena_vegan'];
  const carlos = usersByKey['carlos_mex'];
  const spamBot = usersByKey['spam_bot'];
  const exUtente = usersByKey['ex_utente'];
  const modSarah = usersByKey['sarah_mod'];
  const repeatActive = usersByKey['repeat_offender_active'];
  const tempBanned = usersByKey['temp_banned_user'];

  // 1. Friendships: 12 accepted for mario_bianchi (keeping demo_cook_14/15 & repeat_offender_active as non-friends)
  const marioFriendKeys = [
    'giuly_cooks',
    'chef_marco',
    'sophie_pastry',
    'kenji_noodles',
    'elena_vegan',
    'carlos_mex',
    'demo_cook_01',
    'demo_cook_02',
    'demo_cook_03',
    'demo_cook_04',
    'demo_cook_05',
    'demo_cook_06',
  ];

  const acceptedFriendships: Array<{
    requester_id: number;
    addressee_id: number;
  }> = [];

  for (let i = 0; i < marioFriendKeys.length; i++) {
    const friend = usersByKey[marioFriendKeys[i]];
    if (!friend) continue;
    const isMarioRequester = i % 2 === 0;
    const requester_id = isMarioRequester ? mario.id : friend.id;
    const addressee_id = isMarioRequester ? friend.id : mario.id;
    acceptedFriendships.push({ requester_id, addressee_id });
    await prisma.friendship.create({
      data: {
        requester_id,
        addressee_id,
        status: FriendshipStatus.accepted,
      },
    });
  }

  // Extra accepted links across demo personas
  const extraAcceptedPairs: Array<[User, User]> = [
    [giulia, marco],
    [sophie, elena],
    [kenji, carlos],
  ];
  for (const [req, addr] of extraAcceptedPairs) {
    acceptedFriendships.push({ requester_id: req.id, addressee_id: addr.id });
    await prisma.friendship.create({
      data: {
        requester_id: req.id,
        addressee_id: addr.id,
        status: FriendshipStatus.accepted,
      },
    });
  }

  // Pending incoming & outgoing requests
  const pendingPairs: Array<[User, User]> = [
    [usersByKey['demo_cook_07'], mario],
    [mario, usersByKey['demo_cook_08']],
    [usersByKey['demo_cook_10'], giulia],
  ];
  for (const [req, addr] of pendingPairs) {
    await prisma.friendship.create({
      data: {
        requester_id: req.id,
        addressee_id: addr.id,
        status: FriendshipStatus.pending,
      },
    });
  }

  // Recent rejected friendship (within 30 days) for Friend Request Cooldown
  await prisma.friendship.create({
    data: {
      requester_id: mario.id,
      addressee_id: usersByKey['demo_cook_09'].id,
      status: FriendshipStatus.rejected,
      created_at: new Date(now.getTime() - 7 * DAY_MS),
      updated_at: new Date(now.getTime() - 5 * DAY_MS),
    },
  });

  // 2. User Blocks (without contradicting accepted friendships)
  await prisma.userBlock.createMany({
    data: [
      { blocker_id: mario.id, blocked_id: spamBot.id },
      { blocker_id: giulia.id, blocked_id: usersByKey['demo_cook_15'].id },
    ],
  });

  // 3. Comments (~55+ total: 25+ roots on pizzaPlatform + 9-reply thread)
  const pizza = recipes.byKey['pizzaPlatform'];
  const carbonara = recipes.byKey['carbonara'];
  const tiramisu = recipes.byKey['tiramisu'];
  const risotto = recipes.byKey['risotto'];
  const guacamole = recipes.byKey['guacamole'];

  const commenters = [
    mario,
    giulia,
    marco,
    sophie,
    kenji,
    elena,
    carlos,
    usersByKey['demo_cook_01'],
    usersByKey['demo_cook_02'],
    usersByKey['demo_cook_03'],
    usersByKey['demo_cook_04'],
    usersByKey['demo_cook_05'],
  ];

  const allCommentIds: number[] = [];
  const notificationRows: Array<{
    user_id: number;
    actor_id: number;
    subject: NotificationSubject;
    action: NotificationAction;
    target_id: number;
    details?: string | null;
    is_read: boolean;
    created_at: Date;
  }> = [];

  // 25 root comments on pizzaPlatform (page 2 triggers at limit=20)
  const pizzaRootComments: Array<{ id: number; user_id: number }> = [];
  for (let i = 1; i <= 25; i++) {
    const author = commenters[(i - 1) % commenters.length];
    const isEdited = i === 2 || i === 5;
    const createdAt = new Date(now.getTime() - (30 - i) * 60 * 60 * 1000);
    const created = await prisma.comment.create({
      data: {
        recipe_id: pizza.id,
        user_id: author.id,
        content: `Pizza comment #${i}: crisp crust and balanced San Marzano sauce!`,
        is_active: true,
        is_edited: isEdited,
        created_at: createdAt,
        updated_at: isEdited
          ? new Date(createdAt.getTime() + 15 * 60 * 1000)
          : createdAt,
      },
    });
    pizzaRootComments.push({ id: created.id, user_id: author.id });
    allCommentIds.push(created.id);
  }

  // 9 replies on pizzaRootComments[0] to trigger has_more_replies at replies_limit=5
  const threadRoot = pizzaRootComments[0];
  for (let r = 1; r <= 9; r++) {
    const replier = commenters[r % commenters.length];
    const reply = await prisma.comment.create({
      data: {
        recipe_id: pizza.id,
        user_id: replier.id,
        parent_id: threadRoot.id,
        content: `Reply #${r} to thread: totally agree, 48h fermentation makes all the difference!`,
        is_active: true,
      },
    });
    allCommentIds.push(reply.id);
    if (replier.id !== threadRoot.user_id && notificationRows.length < 15) {
      notificationRows.push({
        user_id: threadRoot.user_id,
        actor_id: replier.id,
        subject: NotificationSubject.comment,
        action: NotificationAction.comment,
        target_id: reply.id,
        is_read: r <= 4,
        created_at: new Date(now.getTime() - r * 30 * 60 * 1000),
      });
    }
  }

  // Deactivated comments tied to spam_bot and ex_utente + multi-reported active comment
  const spamComment = await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: spamBot.id,
      content: 'WIN FREE CRYPTO NOW CLICK HERE!!!',
      is_active: false,
    },
  });
  allCommentIds.push(spamComment.id);

  const exUtenteComment = await prisma.comment.create({
    data: {
      recipe_id: tiramisu.id,
      user_id: exUtente.id,
      content: 'Old comment from a deleted account preserved for thread integrity.',
      is_active: false,
    },
  });
  allCommentIds.push(exUtenteComment.id);

  const multiReportedComment = await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: repeatActive.id,
      content: 'Controversial off-topic rant that received multiple community reports.',
      is_active: true,
    },
  });
  allCommentIds.push(multiReportedComment.id);

  // Additional comments across other showcase recipes to reach 55+ total
  const extraCommentTargets = [
    carbonara,
    tiramisu,
    risotto,
    guacamole,
    recipes.byKey['bruschetta'],
    recipes.byKey['lentilsSoup'],
    recipes.byKey['salmonDish'],
    recipes.byKey['chickenCurry'],
    recipes.byKey['boeufBourguignon'],
    recipes.byKey['caprese'],
    recipes.byKey['ratatouille'],
    recipes.byKey['fondant'],
    recipes.byKey['chiaPudding'],
    recipes.byKey['avocadoToast'],
    recipes.byKey['hummus'],
    recipes.byKey['smoothie'],
    recipes.byKey['espressoMartini'],
    recipes.byKey['croissants'],
  ];

  for (let i = 0; i < extraCommentTargets.length; i++) {
    const target = extraCommentTargets[i];
    if (!target) continue;
    const author =
      commenters.find((c) => c.id !== target.user_id) ?? mario;
    const created = await prisma.comment.create({
      data: {
        recipe_id: target.id,
        user_id: author.id,
        content: `Tried this recipe at home (#${i + 1}) and the flavors were spot on!`,
        is_active: true,
        is_edited: i % 4 === 0,
      },
    });
    allCommentIds.push(created.id);

    if (target.user_id && target.user_id !== author.id) {
      notificationRows.push({
        user_id: target.user_id,
        actor_id: author.id,
        subject: NotificationSubject.recipe,
        action: NotificationAction.comment,
        target_id: target.id,
        is_read: i % 2 === 0,
        created_at: new Date(now.getTime() - (i + 1) * 45 * 60 * 1000),
      });
    }
  }

  // 4. Likes: deterministic, ZERO self-likes (user_id !== recipe.user_id)
  const publicRecipes = recipes.all.filter(
    (r) => r.privacy === RecipePrivacy.public && r.is_active,
  );
  let likesCount = 0;
  for (let rIdx = 0; rIdx < publicRecipes.length; rIdx++) {
    const recipe = publicRecipes[rIdx];
    const likersForRecipe = commenters
      .filter((u) => u.id !== recipe.user_id)
      .slice(0, rIdx < 5 ? 5 : 2);

    for (const liker of likersForRecipe) {
      await prisma.like.create({
        data: {
          user_id: liker.id,
          recipe_id: recipe.id,
        },
      });
      likesCount++;

      if (recipe.user_id && notificationRows.length < 28) {
        notificationRows.push({
          user_id: recipe.user_id,
          actor_id: liker.id,
          subject: NotificationSubject.recipe,
          action: NotificationAction.like,
          target_id: recipe.id,
          is_read: likesCount % 3 === 0,
          created_at: new Date(now.getTime() - likesCount * 20 * 60 * 1000),
        });
      }
    }
  }

  // 5. Friend request / accept & warn notifications (total >= 30)
  for (const [req, addr] of pendingPairs) {
    notificationRows.push({
      user_id: addr.id,
      actor_id: req.id,
      subject: NotificationSubject.user,
      action: NotificationAction.friend_request,
      target_id: req.id,
      is_read: false,
      created_at: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    });
  }

  for (let i = 0; i < Math.min(4, acceptedFriendships.length); i++) {
    const f = acceptedFriendships[i];
    notificationRows.push({
      user_id: f.requester_id,
      actor_id: f.addressee_id,
      subject: NotificationSubject.user,
      action: NotificationAction.friend_accept,
      target_id: f.addressee_id,
      is_read: i < 2,
      created_at: new Date(now.getTime() - (i + 1) * DAY_MS),
    });
  }

  // Warn notifications (actor_id stored as moderator in DB; API masks actor to null for warn)
  notificationRows.push(
    {
      user_id: repeatActive.id,
      actor_id: modSarah.id,
      subject: NotificationSubject.comment,
      action: NotificationAction.warn,
      target_id: multiReportedComment.id,
      details:
        'Please keep recipe comments constructive and respectful of community guidelines.',
      is_read: false,
      created_at: new Date(now.getTime() - 3 * DAY_MS),
    },
    {
      user_id: tempBanned.id,
      actor_id: modSarah.id,
      subject: NotificationSubject.user,
      action: NotificationAction.warn,
      target_id: tempBanned.id,
      details: 'Repeated harassment in comment threads.',
      is_read: true,
      created_at: new Date(now.getTime() - 90 * DAY_MS),
    },
  );

  await prisma.notification.createMany({
    data: notificationRows,
  });

  console.log(
    `[seed:social] Seeded friendships, 2 blocks, ${allCommentIds.length} comments, ${likesCount} likes, ${notificationRows.length} notifications.`,
  );

  return {
    spamCommentId: spamComment.id,
    exUtenteCommentId: exUtenteComment.id,
    multiReportedCommentId: multiReportedComment.id,
    allCommentIds,
  };
}
