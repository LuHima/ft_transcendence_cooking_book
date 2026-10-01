import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { Role, OwnerType, RecipeDifficulty, MediaType, NotificationType, MealType } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🧹 Pulizia dei dati relazionali precedenti (per evitare duplicati)...');
  await prisma.notification.deleteMany();
  await prisma.recipeMedia.deleteMany();
  await prisma.mealPlanRecipe.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipe.deleteMany();

  console.log('🌱 Avvio del seeding database...');

  const passwordHash = await bcrypt.hash('Password123', 10);

  // 1. UTENTI
  console.log('👤 Creazione Utenti...');
  const adminMarghe = await prisma.user.upsert({
    where: { email: 'marghe@example.com' },
    update: {},
    create: {
      username: 'marghe_admin',
      email: 'marghe@example.com',
      password_hash: passwordHash,
      first_name: 'Margherita',
      last_name: 'Dallolio',
      role: Role.admin,
      avatar_url: 'https://i.pravatar.cc/150?u=mario',
    },
  });

  const userMario = await prisma.user.upsert({
    where: { email: 'mario@example.com' },
    update: {},
    create: {
      username: 'mario_bianchi',
      email: 'mario@example.com',
      password_hash: passwordHash,
      first_name: 'Mario',
      last_name: 'Bianchi',
      role: Role.user,
      avatar_url: 'https://i.pravatar.cc/150?u=marghe',
    },
  });

  const userGiulia = await prisma.user.upsert({
    where: { email: 'giulia@example.com' },
    update: {},
    create: {
      username: 'giuly_cooks',
      email: 'giulia@example.com',
      password_hash: passwordHash,
      first_name: 'Giulia',
      last_name: 'Verdi',
      role: Role.user,
      avatar_url: 'https://i.pravatar.cc/150?u=giulia',
    },
  });

  // 2. INGREDIENTI
  console.log('🍅 Creazione Ingredienti...');
  const ingredientNames = [
    'Pasta', 'Pomodoro', 'Basilico', 'Uova', 'Guanciale', 'Pecorino Romano',
    'Olio Extravergine', 'Aglio', 'Sale', 'Pepe', 'Farina', 'Burro', 'Latte',
    'Cacao', 'Mascarpone', 'Caffè', 'Zucchero', 'Savoiardi'
  ];

  const ingredients: Record<string, any> = {};
  for (const name of ingredientNames) {
    ingredients[name] = await prisma.ingredient.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 3. RICETTE
  console.log('🍳 Creazione Ricette...');
  
  const carbonara = await prisma.recipe.create({
    data: {
      user_id: userMario.id,
      owner_type: OwnerType.user,
      title: 'Pasta alla Carbonara',
      description: 'La vera carbonara romana, cremosa e saporita, senza panna!',
      instructions: '1. Cuoci la pasta.\n2. Rosola il guanciale.\n3. Mescola uova e pecorino.\n4. Unisci tutto fuori dal fuoco mantecando con acqua di cottura.',
      prep_time: 25,
      difficulty: RecipeDifficulty.medium,
      recipe_ingredients: {
        create: [
          { ingredient_id: ingredients['Pasta'].id, quantity: 320, unit: 'g' },
          { ingredient_id: ingredients['Uova'].id, quantity: 4, unit: 'pz' },
          { ingredient_id: ingredients['Guanciale'].id, quantity: 150, unit: 'g' },
          { ingredient_id: ingredients['Pecorino Romano'].id, quantity: 80, unit: 'g' },
          { ingredient_id: ingredients['Pepe'].id, quantity: 1, unit: 'q.b.' },
        ],
      },
      recipe_media: {
        create: [
          { media_type: MediaType.image, url: 'https://images.unsplash.com/photo-1612874742237-6526221288c8?w=800', order: 0 },
        ]
      }
    },
  });

  const tiramisu = await prisma.recipe.create({
    data: {
      user_id: userGiulia.id,
      owner_type: OwnerType.user,
      title: 'Tiramisù Classico',
      description: 'Il dolce italiano per eccellenza, con caffè espresso e crema al mascarpone.',
      instructions: '1. Prepara il caffè e lascialo raffreddare.\n2. Monta i tuorli con lo zucchero, poi aggiungi il mascarpone.\n3. Monta gli albumi a neve e incorporali.\n4. Inzuppa i savoiardi e crea gli strati.\n5. Spolvera con cacao amaro.',
      prep_time: 40,
      difficulty: RecipeDifficulty.easy,
      recipe_ingredients: {
        create: [
          { ingredient_id: ingredients['Savoiardi'].id, quantity: 300, unit: 'g' },
          { ingredient_id: ingredients['Mascarpone'].id, quantity: 500, unit: 'g' },
          { ingredient_id: ingredients['Uova'].id, quantity: 4, unit: 'pz' },
          { ingredient_id: ingredients['Caffè'].id, quantity: 300, unit: 'ml' },
          { ingredient_id: ingredients['Cacao'].id, quantity: 30, unit: 'g' },
          { ingredient_id: ingredients['Zucchero'].id, quantity: 100, unit: 'g' },
        ],
      },
      recipe_media: {
        create: [
          { media_type: MediaType.image, url: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800', order: 0 },
          { media_type: MediaType.video, url: 'https://www.youtube.com/watch?v=dummy', order: 1 },
        ]
      }
    },
  });

  const pizzaPlatform = await prisma.recipe.create({
    data: {
      // Nessun user_id, appartiene alla piattaforma
      owner_type: OwnerType.platform,
      title: 'Pizza Margherita (Ricetta Ufficiale)',
      description: 'La ricetta perfetta per l\'impasto della pizza a lunga lievitazione, testata dagli chef della nostra app.',
      instructions: '1. Impasta acqua, farina e lievito.\n2. Aggiungi il sale e l\'olio.\n3. Lascia lievitare per 24 ore in frigo.\n4. Stendi, condisci con pomodoro e cuoci a 250° per 12 min.\n5. Aggiungi il basilico a crudo.',
      prep_time: 1440, // 24 ore
      difficulty: RecipeDifficulty.hard,
      recipe_ingredients: {
        create: [
          { ingredient_id: ingredients['Farina'].id, quantity: 500, unit: 'g' },
          { ingredient_id: ingredients['Pomodoro'].id, quantity: 200, unit: 'g' },
          { ingredient_id: ingredients['Basilico'].id, quantity: 5, unit: 'foglie' },
          { ingredient_id: ingredients['Olio Extravergine'].id, quantity: 20, unit: 'ml' },
          { ingredient_id: ingredients['Sale'].id, quantity: 12, unit: 'g' },
        ],
      },
      recipe_media: {
        create: [
          { media_type: MediaType.image, url: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=800', order: 0 },
        ]
      }
    },
  });

  // 4. INTERAZIONI (Like & Commenti)
  console.log('💬 Aggiunta Commenti, Like e Notifiche...');
  
  // Giulia commenta la carbonara di Mario
  const comment1 = await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: userGiulia.id,
      content: 'Ricetta fantastica! Ma il guanciale lo sfumi con il vino bianco?',
    },
  });

  // Notifica a Mario del commento di Giulia
  await prisma.notification.create({
    data: {
      user_id: userMario.id,
      actor_id: userGiulia.id,
      recipe_id: carbonara.id,
      type: NotificationType.comment,
    }
  });

  // Mario risponde al commento di Giulia
  const reply1 = await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: userMario.id,
      parent_id: comment1.id,
      content: "Assolutamente no! Niente vino e niente aglio, solo il grasso del guanciale 🤤",
    },
  });

  // Giulia e Marghe mettono like al Tiramisù
  await prisma.like.createMany({
    data: [
      { user_id: userGiulia.id, recipe_id: carbonara.id },
      { user_id: adminMarghe.id, recipe_id: tiramisu.id },
    ],
  });

  // Notifiche per i like
  await prisma.notification.createMany({
    data: [
      { user_id: userMario.id, actor_id: userGiulia.id, recipe_id: carbonara.id, type: NotificationType.like },
      { user_id: userGiulia.id, actor_id: adminMarghe.id, recipe_id: tiramisu.id, type: NotificationType.like },
    ]
  });

  // 5. MEAL PLANS
  console.log('📅 Generazione Meal Plan...');
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.mealPlan.create({
    data: {
      user_id: adminMarghe.id,
      start_date: today,
      end_date: tomorrow,
      meal_plan_recipes: {
        create: [
          // Giorno 1
          { recipe_id: carbonara.id, planned_date: today, meal_type: MealType.lunch },
          { recipe_id: tiramisu.id, planned_date: today, meal_type: MealType.snack },
          // Giorno 2
          { recipe_id: pizzaPlatform.id, planned_date: tomorrow, meal_type: MealType.dinner },
        ],
      },
    },
  });

  console.log('✅ Seed completato con successo!');
}

main()
  .catch((e) => {
    console.error('❌ Errore durante il seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });