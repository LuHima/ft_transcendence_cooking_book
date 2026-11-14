import {
  FriendshipStatus,
  NotificationAction,
  NotificationSubject,
  PrismaClient,
  RecipePrivacy,
  User,
} from '@prisma/client';
import { SEED_RECIPE_KEYS } from '../data/recipes.data';
import { SEED_USER_KEYS, type SeedUserKey } from '../data/users.data';
import type { SeedRecipesResult } from './recipes.seeder';

export interface SeedSocialResult {
  spamCommentId: number;
  exUtenteCommentId: number;
  multiReportedCommentId: number;
  offTopicCommentId: number;
  hateSpeechPendingCommentId: number;
  promoSpamPendingCommentId: number;
  allCommentIds: number[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const PIZZA_ROOT_COMMENTS = [
  'The 48-hour cold fermentation really gives the cornicione those airy leopard spots!',
  'Used San Marzano DOP crushed by hand with a pinch of sea salt—pure magic.',
  'Baking it on a preheated pizza stone at max oven temperature worked wonders.',
  'Fresh fior di latte drained overnight prevented any sogginess in the center.',
  'Drizzling extra virgin olive oil right before serving elevates the basil aroma.',
  'Tried this with tipo 00 flour and 65% hydration; easiest dough to stretch so far.',
  'My family finished two pies in ten minutes flat. Definitely making this Friday night.',
  'Tip: tear the basil leaves instead of slicing them so they do not bruise.',
  'Even without a wood-fired oven, the broiler trick gave a fantastic char.',
  'Balanced acidity from the tomatoes and rich creaminess from the mozzarella.',
  'Halved the yeast because my kitchen was warm and the rise was spot on.',
  'Simple ingredients, zero shortcuts, and restaurant-level results at home.',
  'Leftover dough balls froze great and thawed cleanly a week later.',
  'Added a tiny dusting of semolina on the peel—slid onto the stone effortlessly.',
  'Great step-by-step instructions for beginners learning how to shape Neapolitan dough.',
  'The video tutorial helped me nail the slap-and-fold technique on my first try.',
  'Tried grating a light touch of aged Parmigiano underneath the mozzarella—delicious.',
  'Resting the dough balls at room temperature for two hours made stretching effortless.',
  'Best Margherita ratio I have tested on this platform so far.',
  'Loved how clear the prep and fermentation timings are in this recipe.',
  'Turned out crisp on the bottom and pillowy soft around the edges.',
  'Made three variations from the same dough batch and Margherita still won.',
  'Appreciate the preservation notes—reheating in a covered skillet keeps the crust crisp.',
  'Clean, authentic, and reliable every single time.',
  'Bookmarked for our weekend pizza night with friends!',
];

const THREAD_REPLIES = [
  'Completely agree—cold fermentation develops so much depth of flavor.',
  'Did you use fresh cake yeast or instant dry yeast for the 48-hour rise?',
  'I used 1.5g instant dry yeast per kilo of flour and it stayed super light.',
  'Same here! Keeping the fridge around 4°C prevents over-proofing.',
  'Also make sure to take the dough out 2 hours before shaping so the gluten relaxes.',
  'Good call—cold dough snaps right back if you rush the stretching.',
  'Do you preheat the baking steel for a full 45 minutes beforehand?',
  'Yes, 45 to 60 minutes at 250°C plus 2 minutes under the grill at the end.',
  'Thanks for the tips everyone, trying this exact method tonight!',
];

const EXTRA_RECIPE_COMMENTS = [
  'Silky emulsion without a single drop of cream—just pasta water and pecorino.',
  'Resting the mascarpone cream overnight made the layers slice cleanly.',
  'Toasted the rice for two minutes before adding broth and the texture was perfect.',
  'Fresh lime zest and ripe avocados made this disappear before dinner was even ready.',
  'Garlic rubbed onto warm grilled bread while it is still crisp is unbeatable.',
  'Hearty, comforting, and even better the next day for lunch.',
  'Crispy skin on the salmon with tender flaky centers—worked on the first try.',
  'Fragrant spices without overpowering the dish; paired it with steamed basmati.',
  'Slow braising made the beef melt-in-your-mouth tender.',
  'Sweet summer tomatoes and creamy buffalo mozzarella need nothing else.',
  'Rosemary and flaky sea salt gave the roasted potatoes an incredible crunch.',
  'Thinly sliced vegetables baked evenly and looked gorgeous on the table.',
  'Molten chocolate center came out right at the 11-minute mark!',
  'Prepped three jars on Sunday night for quick weekday breakfasts.',
  'Poached egg + chili flakes on sourdough never misses.',
  'Ice water while blending tahini made this hummus extraordinarily smooth.',
  'Refreshing morning boost without any added sugar.',
  'Thick crema on top—shaking vigorously with plenty of ice is key.',
  'Flaky laminated layers took patience but were worth every fold.',
  'Adding a splash of pasta cooking water kept the basil pesto vibrant and glossy.',
  'Runny yolks in the spiced tomato sauce—served straight from the skillet with crusty bread.',
  'Tamarind tang and toasted peanuts balanced the rice noodles beautifully.',
  'Six-minute marinated egg and ginger broth hit the spot on a rainy evening.',
  'The crispy rice layer at the bottom of the pan was the highlight of dinner.',
  'Crisp exterior and herb-packed green interior without feeling heavy.',
  'Rich ragù and silky béchamel—worth every minute in the oven.',
  'Bubbling mozzarella and sweet basil over pillowy potato gnocchi.',
  'Olive oil brine gave the focaccia a golden crust and airy crumb.',
  'Shattering caramelized sugar top over cold vanilla bean custard.',
  'Light, fluffy stack—warm honey and melted butter made breakfast special.',
  'Loaded with seasonal vegetables and beans; tastes like Sunday at nonna’s.',
];

/**
 * Seeds friendships (12+ accepted for mario_bianchi, pending, and recent rejected
 * cooldown), user blocks, ~55+ realistic comments (25+ roots on pizzaPlatform +
 * 9-reply thread + dedicated moderation targets), zero-self-like recipe likes,
 * and ~30+ consistent notifications.
 */
export async function seedSocial(
  prisma: PrismaClient,
  usersByKey: Record<string, User>,
  recipes: SeedRecipesResult,
  now: Date = new Date(),
): Promise<SeedSocialResult> {
  const mario = usersByKey[SEED_USER_KEYS.MARIO_BIANCHI];
  const giulia = usersByKey[SEED_USER_KEYS.GIULY_COOKS];
  const marco = usersByKey[SEED_USER_KEYS.CHEF_MARCO];
  const sophie = usersByKey[SEED_USER_KEYS.SOPHIE_PASTRY];
  const kenji = usersByKey[SEED_USER_KEYS.KENJI_NOODLES];
  const elena = usersByKey[SEED_USER_KEYS.ELENA_VEGAN];
  const carlos = usersByKey[SEED_USER_KEYS.CARLOS_MEX];
  const spamBot = usersByKey[SEED_USER_KEYS.SPAM_BOT];
  const exUtente = usersByKey[SEED_USER_KEYS.EX_UTENTE];
  const modSarah = usersByKey[SEED_USER_KEYS.SARAH_MOD];
  const repeatActive = usersByKey[SEED_USER_KEYS.REPEAT_OFFENDER_ACTIVE];
  const tempBanned = usersByKey[SEED_USER_KEYS.TEMP_BANNED_USER];

  // 1. Friendships: 12 accepted for mario_bianchi (keeping hannah_fischer/tiago_silva & repeat_offender_active as non-friends)
  const marioFriendKeys: SeedUserKey[] = [
    SEED_USER_KEYS.GIULY_COOKS,
    SEED_USER_KEYS.CHEF_MARCO,
    SEED_USER_KEYS.SOPHIE_PASTRY,
    SEED_USER_KEYS.KENJI_NOODLES,
    SEED_USER_KEYS.ELENA_VEGAN,
    SEED_USER_KEYS.CARLOS_MEX,
    SEED_USER_KEYS.LORENZO_FERRI,
    SEED_USER_KEYS.CHIARA_BELLINI,
    SEED_USER_KEYS.MATTEO_GALLI,
    SEED_USER_KEYS.FEDERICA_SERRA,
    SEED_USER_KEYS.ALESSIO_GRECO,
    SEED_USER_KEYS.MARTINA_LEONE,
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

  const pendingPairs: Array<[User, User]> = [
    [usersByKey[SEED_USER_KEYS.DAVIDE_RINALDI], mario],
    [mario, usersByKey[SEED_USER_KEYS.VALENTINA_ORSI]],
    [usersByKey[SEED_USER_KEYS.CAMILLE_LAURENT], giulia],
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
      addressee_id: usersByKey[SEED_USER_KEYS.NICOLA_BRUNO].id,
      status: FriendshipStatus.rejected,
      created_at: new Date(now.getTime() - 7 * DAY_MS),
      updated_at: new Date(now.getTime() - 5 * DAY_MS),
    },
  });

  // 2. User Blocks (without contradicting accepted friendships)
  await prisma.userBlock.createMany({
    data: [
      { blocker_id: mario.id, blocked_id: spamBot.id },
      {
        blocker_id: giulia.id,
        blocked_id: usersByKey[SEED_USER_KEYS.TIAGO_SILVA].id,
      },
    ],
  });

  // 3. Comments (~65+ total across all 32 curated recipes)
  const pizza = recipes.byKey[SEED_RECIPE_KEYS.PIZZA_PLATFORM]!;
  const carbonara = recipes.byKey[SEED_RECIPE_KEYS.CARBONARA]!;
  const tiramisu = recipes.byKey[SEED_RECIPE_KEYS.TIRAMISU]!;
  const risotto = recipes.byKey[SEED_RECIPE_KEYS.RISOTTO]!;
  const guacamole = recipes.byKey[SEED_RECIPE_KEYS.GUACAMOLE]!;

  const commenters = [
    mario,
    giulia,
    marco,
    sophie,
    kenji,
    elena,
    carlos,
    usersByKey[SEED_USER_KEYS.LORENZO_FERRI],
    usersByKey[SEED_USER_KEYS.CHIARA_BELLINI],
    usersByKey[SEED_USER_KEYS.MATTEO_GALLI],
    usersByKey[SEED_USER_KEYS.FEDERICA_SERRA],
    usersByKey[SEED_USER_KEYS.ALESSIO_GRECO],
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
  for (let i = 0; i < PIZZA_ROOT_COMMENTS.length; i++) {
    const author = commenters[i % commenters.length];
    const isEdited = i === 1 || i === 4;
    const createdAt = new Date(now.getTime() - (30 - i) * 60 * 60 * 1000);
    const created = await prisma.comment.create({
      data: {
        recipe_id: pizza.id,
        user_id: author.id,
        content: PIZZA_ROOT_COMMENTS[i],
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
  for (let r = 0; r < THREAD_REPLIES.length; r++) {
    const replier = commenters[(r + 1) % commenters.length];
    const reply = await prisma.comment.create({
      data: {
        recipe_id: pizza.id,
        user_id: replier.id,
        parent_id: threadRoot.id,
        content: THREAD_REPLIES[r],
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
        is_read: r < 4,
        created_at: new Date(now.getTime() - (r + 1) * 30 * 60 * 1000),
      });
    }
  }

  // Dedicated moderation target comments with matching content
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
      content:
        'Old comment from a deleted account preserved for thread integrity.',
      is_active: false,
    },
  });
  allCommentIds.push(exUtenteComment.id);

  const multiReportedComment = await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: repeatActive.id,
      content:
        'Nobody asked for your amateur opinion—stop posting recipes if you cannot cook.',
      is_active: true,
    },
  });
  allCommentIds.push(multiReportedComment.id);

  const offTopicComment = await prisma.comment.create({
    data: {
      recipe_id: risotto.id,
      user_id: usersByKey[SEED_USER_KEYS.HANNAH_FISCHER].id,
      content:
        'Does anyone know what time the local farmers market closes today?',
      is_active: true,
    },
  });
  allCommentIds.push(offTopicComment.id);

  const hateSpeechPendingComment = await prisma.comment.create({
    data: {
      recipe_id: guacamole.id,
      user_id: usersByKey[SEED_USER_KEYS.TIAGO_SILVA].id,
      content: 'Hostile and derogatory remark awaiting moderator review.',
      is_active: true,
    },
  });
  allCommentIds.push(hateSpeechPendingComment.id);

  const promoSpamPendingComment = await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: usersByKey[SEED_USER_KEYS.HANNAH_FISCHER].id,
      content: 'Use promo code CHEAPKNIVES50 on my storefront for 50% off!',
      is_active: true,
    },
  });
  allCommentIds.push(promoSpamPendingComment.id);

  // Additional realistic comments across all remaining 31 curated recipes
  const extraCommentTargets = [
    carbonara,
    tiramisu,
    risotto,
    guacamole,
    recipes.byKey[SEED_RECIPE_KEYS.BRUSCHETTA],
    recipes.byKey[SEED_RECIPE_KEYS.LENTILS_SOUP],
    recipes.byKey[SEED_RECIPE_KEYS.SALMON_DISH],
    recipes.byKey[SEED_RECIPE_KEYS.CHICKEN_CURRY],
    recipes.byKey[SEED_RECIPE_KEYS.BOEUF_BOURGUIGNON],
    recipes.byKey[SEED_RECIPE_KEYS.CAPRESE],
    recipes.byKey[SEED_RECIPE_KEYS.BAKED_POTATOES],
    recipes.byKey[SEED_RECIPE_KEYS.RATATOUILLE],
    recipes.byKey[SEED_RECIPE_KEYS.FONDANT],
    recipes.byKey[SEED_RECIPE_KEYS.CHIA_PUDDING],
    recipes.byKey[SEED_RECIPE_KEYS.AVOCADO_TOAST],
    recipes.byKey[SEED_RECIPE_KEYS.HUMMUS],
    recipes.byKey[SEED_RECIPE_KEYS.SMOOTHIE],
    recipes.byKey[SEED_RECIPE_KEYS.ESPRESSO_MARTINI],
    recipes.byKey[SEED_RECIPE_KEYS.CROISSANTS],
    recipes.byKey[SEED_RECIPE_KEYS.PASTA_PESTO],
    recipes.byKey[SEED_RECIPE_KEYS.SHAKSHUKA],
    recipes.byKey[SEED_RECIPE_KEYS.PAD_THAI],
    recipes.byKey[SEED_RECIPE_KEYS.RAMEN],
    recipes.byKey[SEED_RECIPE_KEYS.PAELLA],
    recipes.byKey[SEED_RECIPE_KEYS.FALAFEL],
    recipes.byKey[SEED_RECIPE_KEYS.LASAGNA],
    recipes.byKey[SEED_RECIPE_KEYS.GNOCCHI],
    recipes.byKey[SEED_RECIPE_KEYS.FOCACCIA],
    recipes.byKey[SEED_RECIPE_KEYS.CREME_BRULEE],
    recipes.byKey[SEED_RECIPE_KEYS.PANCAKES],
    recipes.byKey[SEED_RECIPE_KEYS.MINESTRONE],
  ];

  for (let i = 0; i < extraCommentTargets.length; i++) {
    const target = extraCommentTargets[i];
    if (!target) continue;
    const rotated = [
      ...commenters.slice(i % commenters.length),
      ...commenters.slice(0, i % commenters.length),
    ];
    const author = rotated.find((c) => c.id !== target.user_id) ?? mario;
    const created = await prisma.comment.create({
      data: {
        recipe_id: target.id,
        user_id: author.id,
        content: EXTRA_RECIPE_COMMENTS[i % EXTRA_RECIPE_COMMENTS.length],
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

  // Warn notifications aligned with resolved ReportSubject.user warn reports
  notificationRows.push(
    {
      user_id: repeatActive.id,
      actor_id: modSarah.id,
      subject: NotificationSubject.user,
      action: NotificationAction.warn,
      target_id: repeatActive.id,
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
    offTopicCommentId: offTopicComment.id,
    hateSpeechPendingCommentId: hateSpeechPendingComment.id,
    promoSpamPendingCommentId: promoSpamPendingComment.id,
    allCommentIds,
  };
}
