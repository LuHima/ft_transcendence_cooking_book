import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  Role,
  UserStatus,
  OwnerType,
  RecipeDifficulty,
  MediaType,
  MealType,
  IngredientCategory,
  UnitOfMeasure,
  TranslationStatus,
  Course,
  NotificationSubject,
  NotificationAction,
  FriendshipStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL ?? '',
});
const prisma = new PrismaClient({ adapter });

interface SeedRecipeInput {
  authorId?: number | null;
  ownerType?: OwnerType;
  course: Course;
  difficulty: RecipeDifficulty;
  prepTime: number;
  cookTime: number;
  servings: number;
  coverImageUrl?: string;
  videoUrl?: string;
  tagSlugs: string[];
  translations: {
    it: {
      title: string;
      description: string;
      tips?: string;
      preservation?: string;
    };
    en: {
      title: string;
      description: string;
      tips?: string;
      preservation?: string;
    };
    fr: {
      title: string;
      description: string;
      tips?: string;
      preservation?: string;
    };
  };
  steps: Array<{
    duration?: number;
    imageUrl?: string;
    translations: {
      it: { title?: string; description: string };
      en: { title?: string; description: string };
      fr: { title?: string; description: string };
    };
  }>;
  ingredients: Array<{
    slug: string;
    quantity: number;
    unit: UnitOfMeasure;
    notes?: { it: string; en: string; fr: string };
  }>;
  media?: Array<{
    mediaType: MediaType;
    url: string;
  }>;
}

async function main() {
  console.log(
    '🧹 Pulizia dei dati relazionali precedenti (per evitare duplicati)...',
  );
  await prisma.friendship.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.recipeMedia.deleteMany();
  await prisma.mealPlanRecipe.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.like.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.recipeTag.deleteMany();
  await prisma.recipeIngredient.deleteMany();
  await prisma.recipeStepTranslation.deleteMany();
  await prisma.recipeStep.deleteMany();
  await prisma.recipeTranslation.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.tagTranslation.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.ingredientTranslation.deleteMany();
  await prisma.ingredient.deleteMany();

  console.log('🌱 Avvio del seeding database...');

  const passwordHash = await bcrypt.hash('Password123', 10);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. UTENTI
  // ─────────────────────────────────────────────────────────────────────────
  console.log('👤 Creazione Utenti con ruoli e stati diversificati...');

  // Admin
  const adminMarghe = await prisma.user.upsert({
    where: { email: 'marghe@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    },
    create: {
      username: 'marghe_admin',
      email: 'marghe@example.com',
      password_hash: passwordHash,
      first_name: 'Margherita',
      last_name: 'Dallolio',
      role: Role.admin,
      avatar_url:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    },
  });

  // Moderator
  const modSarah = await prisma.user.upsert({
    where: { email: 'sarah@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    },
    create: {
      username: 'sarah_mod',
      email: 'sarah@example.com',
      password_hash: passwordHash,
      first_name: 'Sarah',
      last_name: 'Jenkins',
      role: Role.moderator,
      avatar_url:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
    },
  });

  // Standard Users / Food Creators
  const userMario = await prisma.user.upsert({
    where: { email: 'mario@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    },
    create: {
      username: 'mario_bianchi',
      email: 'mario@example.com',
      password_hash: passwordHash,
      first_name: 'Mario',
      last_name: 'Bianchi',
      role: Role.user,
      avatar_url:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    },
  });

  const userGiulia = await prisma.user.upsert({
    where: { email: 'giulia@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    },
    create: {
      username: 'giuly_cooks',
      email: 'giulia@example.com',
      password_hash: passwordHash,
      first_name: 'Giulia',
      last_name: 'Verdi',
      role: Role.user,
      avatar_url:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    },
  });

  const userMarco = await prisma.user.upsert({
    where: { email: 'marco@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    },
    create: {
      username: 'chef_marco',
      email: 'marco@example.com',
      password_hash: passwordHash,
      first_name: 'Marco',
      last_name: 'Rossi',
      role: Role.user,
      avatar_url:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    },
  });

  const userSophie = await prisma.user.upsert({
    where: { email: 'sophie@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    },
    create: {
      username: 'sophie_pastry',
      email: 'sophie@example.com',
      password_hash: passwordHash,
      first_name: 'Sophie',
      last_name: 'Dubois',
      role: Role.user,
      avatar_url:
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400',
    },
  });

  const userKenji = await prisma.user.upsert({
    where: { email: 'kenji@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    },
    create: {
      username: 'kenji_noodles',
      email: 'kenji@example.com',
      password_hash: passwordHash,
      first_name: 'Kenji',
      last_name: 'Tanaka',
      role: Role.user,
      avatar_url:
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400',
    },
  });

  const userElena = await prisma.user.upsert({
    where: { email: 'elena@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
    },
    create: {
      username: 'elena_vegan',
      email: 'elena@example.com',
      password_hash: passwordHash,
      first_name: 'Elena',
      last_name: 'Rostova',
      role: Role.user,
      avatar_url:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
    },
  });

  const userCarlos = await prisma.user.upsert({
    where: { email: 'carlos@example.com' },
    update: {
      avatar_url:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    },
    create: {
      username: 'carlos_mex',
      email: 'carlos@example.com',
      password_hash: passwordHash,
      first_name: 'Carlos',
      last_name: 'Ramirez',
      role: Role.user,
      avatar_url:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400',
    },
  });

  // User with Two-Factor Authentication enabled (for 2FA API testing)
  const userAlex2FA = await prisma.user.upsert({
    where: { email: 'alex2fa@example.com' },
    update: {},
    create: {
      username: 'alex_secure',
      email: 'alex2fa@example.com',
      password_hash: passwordHash,
      first_name: 'Alex',
      last_name: 'Vance',
      role: Role.user,
      avatar_url:
        'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400',
      is_two_factor_enabled: true,
      two_factor: 'JBSWY3DPEHPK3PXP', // Base32 sample OTP secret
    },
  });

  // Admin moderation test users
  const userDisabled = await prisma.user.upsert({
    where: { email: 'luca@example.com' },
    update: {},
    create: {
      username: 'luca_disattivato',
      email: 'luca@example.com',
      password_hash: passwordHash,
      role: Role.user,
      status: UserStatus.disabled,
    },
  });

  const userBanned = await prisma.user.upsert({
    where: { email: 'spam@example.com' },
    update: {},
    create: {
      username: 'spam_bot',
      email: 'spam@example.com',
      password_hash: passwordHash,
      role: Role.user,
      status: UserStatus.banned,
    },
  });

  await prisma.user.upsert({
    where: { email: 'ex@example.com' },
    update: {},
    create: {
      username: 'ex_utente',
      email: 'ex@example.com',
      password_hash: passwordHash,
      role: Role.user,
      status: UserStatus.disabled,
      deleted_at: new Date(),
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. INGREDIENTI
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🍅 Creazione Ingredienti completi...');

  const baselineIngredients = [
    // Produce
    {
      slug: 'tomato',
      category: IngredientCategory.produce,
      name_it: 'Pomodoro',
      name_en: 'Tomato',
      name_fr: 'Tomate',
    },
    {
      slug: 'basil',
      category: IngredientCategory.produce,
      name_it: 'Basilico',
      name_en: 'Basil',
      name_fr: 'Basilic',
    },
    {
      slug: 'garlic',
      category: IngredientCategory.produce,
      name_it: 'Aglio',
      name_en: 'Garlic',
      name_fr: 'Ail',
    },
    {
      slug: 'onion',
      category: IngredientCategory.produce,
      name_it: 'Cipolla',
      name_en: 'Onion',
      name_fr: 'Oignon',
    },
    {
      slug: 'lemon',
      category: IngredientCategory.produce,
      name_it: 'Limone',
      name_en: 'Lemon',
      name_fr: 'Citron',
    },
    {
      slug: 'avocado',
      category: IngredientCategory.produce,
      name_it: 'Avocado',
      name_en: 'Avocado',
      name_fr: 'Avocat',
    },
    {
      slug: 'lime',
      category: IngredientCategory.produce,
      name_it: 'Lime',
      name_en: 'Lime',
      name_fr: 'Citron Vert',
    },
    {
      slug: 'cilantro',
      category: IngredientCategory.produce,
      name_it: 'Coriandolo Fresco',
      name_en: 'Fresh Cilantro',
      name_fr: 'Coriandre Fraîche',
    },
    {
      slug: 'mushrooms',
      category: IngredientCategory.produce,
      name_it: 'Funghi Porcini',
      name_en: 'Porcini Mushrooms',
      name_fr: 'Cèpes',
    },
    {
      slug: 'potatoes',
      category: IngredientCategory.produce,
      name_it: 'Patate',
      name_en: 'Potatoes',
      name_fr: 'Pommes de Terre',
    },
    {
      slug: 'rosemary',
      category: IngredientCategory.produce,
      name_it: 'Rosmarino Fresco',
      name_en: 'Fresh Rosemary',
      name_fr: 'Romarin Frais',
    },
    {
      slug: 'eggplant',
      category: IngredientCategory.produce,
      name_it: 'Melanzane',
      name_en: 'Eggplant',
      name_fr: 'Aubergine',
    },
    {
      slug: 'zucchini',
      category: IngredientCategory.produce,
      name_it: 'Zucchine',
      name_en: 'Zucchini',
      name_fr: 'Courgettes',
    },
    {
      slug: 'bell_pepper',
      category: IngredientCategory.produce,
      name_it: 'Peperoni',
      name_en: 'Bell Peppers',
      name_fr: 'Poivrons',
    },
    {
      slug: 'carrots',
      category: IngredientCategory.produce,
      name_it: 'Carote',
      name_en: 'Carrots',
      name_fr: 'Carottes',
    },
    {
      slug: 'banana',
      category: IngredientCategory.produce,
      name_it: 'Banana',
      name_en: 'Banana',
      name_fr: 'Banane',
    },
    {
      slug: 'berries',
      category: IngredientCategory.produce,
      name_it: 'Frutti di Bosco',
      name_en: 'Mixed Berries',
      name_fr: 'Fruits des Bois',
    },
    {
      slug: 'cucumber',
      category: IngredientCategory.produce,
      name_it: 'Cetriolo',
      name_en: 'Cucumber',
      name_fr: 'Concombre',
    },

    // Dairy & Eggs
    {
      slug: 'eggs',
      category: IngredientCategory.dairy_eggs,
      name_it: 'Uova',
      name_en: 'Eggs',
      name_fr: 'Œufs',
    },
    {
      slug: 'butter',
      category: IngredientCategory.dairy_eggs,
      name_it: 'Burro',
      name_en: 'Butter',
      name_fr: 'Beurre',
    },
    {
      slug: 'milk',
      category: IngredientCategory.dairy_eggs,
      name_it: 'Latte',
      name_en: 'Milk',
      name_fr: 'Lait',
    },
    {
      slug: 'parmesan',
      category: IngredientCategory.dairy_eggs,
      name_it: 'Parmigiano Reggiano',
      name_en: 'Parmesan',
      name_fr: 'Parmesan',
    },
    {
      slug: 'pecorino',
      category: IngredientCategory.dairy_eggs,
      name_it: 'Pecorino Romano',
      name_en: 'Pecorino Romano',
      name_fr: 'Pecorino Romano',
    },
    {
      slug: 'mascarpone',
      category: IngredientCategory.dairy_eggs,
      name_it: 'Mascarpone',
      name_en: 'Mascarpone',
      name_fr: 'Mascarpone',
    },
    {
      slug: 'mozzarella',
      category: IngredientCategory.dairy_eggs,
      name_it: 'Mozzarella di Bufala',
      name_en: 'Buffalo Mozzarella',
      name_fr: 'Mozzarella de Bufflonne',
    },
    {
      slug: 'cream',
      category: IngredientCategory.dairy_eggs,
      name_it: 'Panna Fresca',
      name_en: 'Heavy Cream',
      name_fr: 'Crème Fraîche',
    },

    // Meat & Poultry
    {
      slug: 'guanciale',
      category: IngredientCategory.meat_poultry,
      name_it: 'Guanciale',
      name_en: 'Cured Pork Cheek',
      name_fr: 'Guanciale',
    },
    {
      slug: 'chicken_breast',
      category: IngredientCategory.meat_poultry,
      name_it: 'Petto di Pollo',
      name_en: 'Chicken Breast',
      name_fr: 'Blanc de Poulet',
    },
    {
      slug: 'beef_mince',
      category: IngredientCategory.meat_poultry,
      name_it: 'Macinato di Manzo',
      name_en: 'Minced Beef',
      name_fr: 'Bœuf Haché',
    },
    {
      slug: 'beef_chuck',
      category: IngredientCategory.meat_poultry,
      name_it: 'Spezzatino di Manzo',
      name_en: 'Beef Chuck Roast',
      name_fr: 'Bœuf Bourguignon',
    },

    // Seafood
    {
      slug: 'salmon',
      category: IngredientCategory.seafood,
      name_it: 'Salmone Fresco',
      name_en: 'Fresh Salmon',
      name_fr: 'Saumon Frais',
    },
    {
      slug: 'prawns',
      category: IngredientCategory.seafood,
      name_it: 'Gamberi',
      name_en: 'Prawns',
      name_fr: 'Crevettes',
    },

    // Bakery & Grains
    {
      slug: 'pasta',
      category: IngredientCategory.bakery_grains,
      name_it: 'Pasta',
      name_en: 'Pasta',
      name_fr: 'Pâtes',
    },
    {
      slug: 'flour',
      category: IngredientCategory.bakery_grains,
      name_it: 'Farina',
      name_en: 'Flour',
      name_fr: 'Farine',
    },
    {
      slug: 'rice',
      category: IngredientCategory.bakery_grains,
      name_it: 'Riso Carnaroli',
      name_en: 'Carnaroli Rice',
      name_fr: 'Riz Carnaroli',
    },
    {
      slug: 'ladyfingers',
      category: IngredientCategory.bakery_grains,
      name_it: 'Savoiardi',
      name_en: 'Ladyfingers',
      name_fr: 'Biscuits Cuillère',
    },
    {
      slug: 'bread',
      category: IngredientCategory.bakery_grains,
      name_it: 'Pane Rustico',
      name_en: 'Crusty Bread',
      name_fr: 'Pain Rustique',
    },
    {
      slug: 'chia_seeds',
      category: IngredientCategory.bakery_grains,
      name_it: 'Semi di Chia',
      name_en: 'Chia Seeds',
      name_fr: 'Graines de Chia',
    },
    {
      slug: 'yeast',
      category: IngredientCategory.bakery_grains,
      name_it: 'Lievito di Birra',
      name_en: 'Brewer Yeast',
      name_fr: 'Levure de Boulanger',
    },

    // Pantry & Spices
    {
      slug: 'olive_oil',
      category: IngredientCategory.pantry_spices,
      name_it: 'Olio Extravergine d’Oliva',
      name_en: 'Extra Virgin Olive Oil',
      name_fr: "Huile d'Olive Extra Vierge",
    },
    {
      slug: 'salt',
      category: IngredientCategory.pantry_spices,
      name_it: 'Sale Marino',
      name_en: 'Sea Salt',
      name_fr: 'Sel Marin',
    },
    {
      slug: 'black_pepper',
      category: IngredientCategory.pantry_spices,
      name_it: 'Pepe Nero',
      name_en: 'Black Pepper',
      name_fr: 'Poivre Noir',
    },
    {
      slug: 'sugar',
      category: IngredientCategory.pantry_spices,
      name_it: 'Zucchero Semolato',
      name_en: 'Sugar',
      name_fr: 'Sucre',
    },
    {
      slug: 'cocoa',
      category: IngredientCategory.pantry_spices,
      name_it: 'Cacao Amaro',
      name_en: 'Cocoa Powder',
      name_fr: 'Cacao en Poudre',
    },
    {
      slug: 'dark_chocolate',
      category: IngredientCategory.pantry_spices,
      name_it: 'Cioccolato Fondente',
      name_en: 'Dark Chocolate (70%)',
      name_fr: 'Chocolat Noir (70%)',
    },
    {
      slug: 'curry_powder',
      category: IngredientCategory.pantry_spices,
      name_it: 'Curry Dolce in Polvere',
      name_en: 'Mild Curry Powder',
      name_fr: 'Poudre de Curry Doux',
    },
    {
      slug: 'tahini',
      category: IngredientCategory.pantry_spices,
      name_it: 'Salsa Tahina',
      name_en: 'Tahini Paste',
      name_fr: 'Pâte de Sésame (Tahini)',
    },

    // Legumes & Nuts
    {
      slug: 'lentils',
      category: IngredientCategory.legumes_nuts,
      name_it: 'Lenticchie Secche',
      name_en: 'Dry Lentils',
      name_fr: 'Lentilles Sèches',
    },
    {
      slug: 'walnuts',
      category: IngredientCategory.legumes_nuts,
      name_it: 'Gherigli di Noce',
      name_en: 'Walnut Halves',
      name_fr: 'Cerneaux de Noix',
    },
    {
      slug: 'chickpeas',
      category: IngredientCategory.legumes_nuts,
      name_it: 'Ceci Lessati',
      name_en: 'Cooked Chickpeas',
      name_fr: 'Pois Chiches Cuits',
    },

    // Beverages & Liquids
    {
      slug: 'coffee',
      category: IngredientCategory.beverages_liquids,
      name_it: 'Caffè Espresso',
      name_en: 'Espresso Coffee',
      name_fr: 'Café Espresso',
    },
    {
      slug: 'white_wine',
      category: IngredientCategory.beverages_liquids,
      name_it: 'Vino Bianco Secco',
      name_en: 'Dry White Wine',
      name_fr: 'Vin Blanc Sec',
    },
    {
      slug: 'red_wine',
      category: IngredientCategory.beverages_liquids,
      name_it: 'Vino Rosso Corposo',
      name_en: 'Dry Red Wine',
      name_fr: 'Vin Rouge Corsé',
    },
    {
      slug: 'coconut_milk',
      category: IngredientCategory.beverages_liquids,
      name_it: 'Latte di Cocco',
      name_en: 'Coconut Milk',
      name_fr: 'Lait de Coco',
    },
    {
      slug: 'vodka',
      category: IngredientCategory.beverages_liquids,
      name_it: 'Vodka',
      name_en: 'Vodka',
      name_fr: 'Vodka',
    },
    {
      slug: 'coffee_liqueur',
      category: IngredientCategory.beverages_liquids,
      name_it: 'Liquore al Caffè',
      name_en: 'Coffee Liqueur',
      name_fr: 'Liqueur de Café',
    },

    // Other
    {
      slug: 'vanilla',
      category: IngredientCategory.other,
      name_it: 'Estratto Naturale di Vaniglia',
      name_en: 'Vanilla Extract',
      name_fr: 'Extrait Naturel de Vanille',
    },
  ];

  const ingredients: Record<string, any> = {};
  for (const item of baselineIngredients) {
    const record = await prisma.ingredient.upsert({
      where: { slug: item.slug },
      update: { category: item.category },
      create: {
        slug: item.slug,
        category: item.category,
      },
    });

    const locales = [
      { locale: 'it', name: item.name_it },
      { locale: 'en', name: item.name_en },
      { locale: 'fr', name: item.name_fr },
    ];

    for (const t of locales) {
      await prisma.ingredientTranslation.upsert({
        where: {
          ingredient_id_locale: {
            ingredient_id: record.id,
            locale: t.locale,
          },
        },
        update: { name: t.name },
        create: {
          ingredient_id: record.id,
          locale: t.locale,
          name: t.name,
        },
      });
    }

    ingredients[item.slug] = record;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. TAGS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🏷️ Creazione Tag curati...');
  const tags: Record<string, any> = {};
  const baselineTags = [
    {
      slug: 'vegetarian',
      name_it: 'Vegetariano',
      name_en: 'Vegetarian',
      name_fr: 'Végétarien',
    },
    {
      slug: 'vegan',
      name_it: 'Vegano',
      name_en: 'Vegan',
      name_fr: 'Végétalien',
    },
    {
      slug: 'gluten_free',
      name_it: 'Senza Glutine',
      name_en: 'Gluten-Free',
      name_fr: 'Sans Gluten',
    },
    {
      slug: 'dairy_free',
      name_it: 'Senza Lattosio',
      name_en: 'Dairy-Free',
      name_fr: 'Sans Produits Laitiers',
    },
    {
      slug: 'nut_free',
      name_it: 'Senza Frutta a Guscio',
      name_en: 'Nut-Free',
      name_fr: 'Sans Fruits à Coque',
    },
    {
      slug: 'low_carb',
      name_it: 'A Basso Contenuto di Carboidrati',
      name_en: 'Low-Carb',
      name_fr: 'Faible en Glucides',
    },
    {
      slug: 'quick_easy',
      name_it: 'Veloce e Facile',
      name_en: 'Quick & Easy',
      name_fr: 'Rapide et Facile',
    },
    {
      slug: 'traditional',
      name_it: 'Tradizionale',
      name_en: 'Traditional',
      name_fr: 'Traditionnel',
    },
    {
      slug: 'comfort_food',
      name_it: 'Comfort Food',
      name_en: 'Comfort Food',
      name_fr: 'Plat Réconfortant',
    },
    {
      slug: 'budget_friendly',
      name_it: 'Economico',
      name_en: 'Budget-Friendly',
      name_fr: 'Économique',
    },
    {
      slug: 'summer',
      name_it: 'Estivo',
      name_en: 'Summer',
      name_fr: 'Estival',
    },
    {
      slug: 'winter',
      name_it: 'Invernale',
      name_en: 'Winter',
      name_fr: 'Hivernal',
    },
  ];

  for (const tag of baselineTags) {
    const tagRecord = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: { slug: tag.slug },
    });
    tags[tag.slug] = tagRecord;

    const locales = [
      { locale: 'it', name: tag.name_it },
      { locale: 'en', name: tag.name_en },
      { locale: 'fr', name: tag.name_fr },
    ];

    for (const t of locales) {
      await prisma.tagTranslation.upsert({
        where: {
          tag_id_locale: {
            tag_id: tagRecord.id,
            locale: t.locale,
          },
        },
        update: { name: t.name },
        create: {
          tag_id: tagRecord.id,
          locale: t.locale,
          name: t.name,
        },
      });
    }
  }

  // Helper per inserimento ricette con validazione forte dei tipi
  async function seedRecipe(input: SeedRecipeInput) {
    const totalTime = input.prepTime + input.cookTime;

    return await prisma.recipe.create({
      data: {
        user_id: input.authorId ?? null,
        owner_type:
          input.ownerType ??
          (input.authorId ? OwnerType.user : OwnerType.platform),
        course: input.course,
        difficulty: input.difficulty,
        prep_time: input.prepTime,
        cook_time: input.cookTime,
        total_time: totalTime,
        servings: input.servings,
        source_lang: 'it',
        translation_status: TranslationStatus.completed,
        cover_image_url: input.coverImageUrl,
        video_url: input.videoUrl,
        translations: {
          create: [
            {
              locale: 'it',
              title: input.translations.it.title,
              description: input.translations.it.description,
              tips: input.translations.it.tips,
              preservation: input.translations.it.preservation,
            },
            {
              locale: 'en',
              title: input.translations.en.title,
              description: input.translations.en.description,
              tips: input.translations.en.tips,
              preservation: input.translations.en.preservation,
            },
            {
              locale: 'fr',
              title: input.translations.fr.title,
              description: input.translations.fr.description,
              tips: input.translations.fr.tips,
              preservation: input.translations.fr.preservation,
            },
          ],
        },
        steps: {
          create: input.steps.map((st, idx) => ({
            step_number: idx + 1,
            duration: st.duration ?? 5,
            image_url: st.imageUrl,
            translations: {
              create: [
                {
                  locale: 'it',
                  title: st.translations.it.title,
                  description: st.translations.it.description,
                },
                {
                  locale: 'en',
                  title: st.translations.en.title,
                  description: st.translations.en.description,
                },
                {
                  locale: 'fr',
                  title: st.translations.fr.title,
                  description: st.translations.fr.description,
                },
              ],
            },
          })),
        },
        recipe_ingredients: {
          create: input.ingredients.map((ing) => ({
            ingredient_id: ingredients[ing.slug].id,
            quantity: ing.quantity,
            unit: ing.unit,
            notes: ing.notes,
          })),
        },
        recipe_tags: {
          create: input.tagSlugs.map((slug) => ({
            tag_id: tags[slug].id,
          })),
        },
        recipe_media: input.media
          ? {
              create: input.media.map((m, idx) => ({
                media_type: m.mediaType,
                url: m.url,
                order: idx,
              })),
            }
          : undefined,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. RICETTE DIVERSIFICATE (Tutte le portate, difficoltà, tempi e tag)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🍳 Creazione Catalogo Ricette esteso (20 ricette)...');

  // 1. Carbonara (First Course, Medium, 25 min)
  const carbonara = await seedRecipe({
    authorId: userMario.id,
    course: Course.first_course,
    difficulty: RecipeDifficulty.medium,
    prepTime: 15,
    cookTime: 10,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800',
    tagSlugs: ['quick_easy', 'traditional', 'comfort_food'],
    translations: {
      it: {
        title: 'Pasta alla Carbonara Classica',
        description:
          'La vera carbonara romana, cremosa e vellutata, realizzata solo con tuorli, pecorino e guanciale croccante.',
        tips: 'Mantecare rigorosamente fuori dal fuoco per evitare l’effetto frittata.',
        preservation: 'Da consumare immediatamente calda.',
      },
      en: {
        title: 'Authentic Roman Spaghetti Carbonara',
        description:
          'Traditional creamy Roman carbonara made with fresh egg yolks, sharp Pecorino Romano, and crispy guanciale without cream.',
        tips: 'Mix pasta off the heat to keep the egg sauce silky and prevent scrambling.',
        preservation: 'Best enjoyed immediately while piping hot.',
      },
      fr: {
        title: 'Spaghetti Carbonara Traditionnels',
        description:
          'L’authentique carbonara romaine, onctueuse et savoureuse, préparée avec des jaunes d’œufs, du pecorino et du guanciale croustillant.',
        tips: 'Mélangez hors du feu pour obtenir une crème parfaite sans cuire les œufs en omelette.',
        preservation: 'À déguster immédiatement bien chaud.',
      },
    },
    steps: [
      {
        duration: 5,
        translations: {
          it: {
            title: 'Rosolare il guanciale',
            description:
              'Taglia il guanciale a listarelle e fallo sudare in padella senza olio finché non è ben dorato e croccante.',
          },
          en: {
            title: 'Brown the guanciale',
            description:
              'Slice guanciale into strips and render in a skillet until crisp and golden brown.',
          },
          fr: {
            title: 'Dorer le guanciale',
            description:
              'Coupez le guanciale en lardons et faites-le dorer sans matière grasse jusqu’à ce qu’il soit croustillant.',
          },
        },
      },
      {
        duration: 10,
        translations: {
          it: {
            title: 'Lessare la pasta',
            description:
              'Cuoci gli spaghetti in abbondante acqua poco salata fino a ottenere una consistenza al dente.',
          },
          en: {
            title: 'Boil pasta',
            description:
              'Cook spaghetti in salted boiling water until al dente, reserving a ladle of pasta water.',
          },
          fr: {
            title: 'Cuire les pâtes',
            description:
              'Faites cuire les spaghetti dans une grande casserole d’eau légèrement salée jusqu’à consistance al dente.',
          },
        },
      },
      {
        duration: 5,
        translations: {
          it: {
            title: 'Crema di tuorli e mantecatura',
            description:
              'Sbatti i tuorli con il pecorino e tanto pepe nero. Unisci la pasta scolata al grasso del guanciale, spegni il fuoco e incorpora la crema d’uovo mantecando.',
          },
          en: {
            title: 'Combine and emulsify',
            description:
              'Whisk egg yolks with grated pecorino and black pepper. Remove skillet from heat, toss pasta with guanciale fat, and fold in egg mixture.',
          },
          fr: {
            title: 'Lier la sauce',
            description:
              'Battez les jaunes d’œufs avec le pecorino et du poivre noir. Hors du feu, ajoutez les pâtes et incorporez le mélange crémeux.',
          },
        },
      },
    ],
    ingredients: [
      {
        slug: 'pasta',
        quantity: 360,
        unit: UnitOfMeasure.g,
        notes: {
          it: 'spaghetti trafilati al bronzo',
          en: 'bronze-die spaghetti',
          fr: 'spaghetti',
        },
      },
      { slug: 'guanciale', quantity: 160, unit: UnitOfMeasure.g },
      {
        slug: 'eggs',
        quantity: 4,
        unit: UnitOfMeasure.piece,
        notes: { it: 'tuorli freschi', en: 'fresh yolks', fr: 'jaunes frais' },
      },
      {
        slug: 'pecorino',
        quantity: 90,
        unit: UnitOfMeasure.g,
        notes: {
          it: 'grattugiato finemente',
          en: 'finely grated',
          fr: 'finement râpé',
        },
      },
      { slug: 'black_pepper', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
    media: [
      {
        mediaType: MediaType.image,
        url: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800',
      },
    ],
  });

  // 2. Tiramisù (Dessert, Easy, 40 min)
  const tiramisu = await seedRecipe({
    authorId: userGiulia.id,
    course: Course.dessert,
    difficulty: RecipeDifficulty.easy,
    prepTime: 25,
    cookTime: 15,
    servings: 6,
    coverImageUrl:
      'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800',
    videoUrl: 'https://www.youtube.com/watch?v=dummy_tiramisu',
    tagSlugs: ['traditional', 'vegetarian', 'comfort_food'],
    translations: {
      it: {
        title: 'Tiramisù Tradizionale di Casa',
        description:
          'La celebre ricetta veneta a base di savoiardi imbevuti di caffè moka e crema montata al mascarpone con uova fresche.',
        tips: 'Usa caffè espresso lasciato raffreddare completamente per non sciogliere i savoiardi.',
        preservation: 'Conservare coperto in frigorifero per massimo 48 ore.',
      },
      en: {
        title: 'Homemade Classic Italian Tiramisu',
        description:
          'The beloved Italian coffee-flavored dessert featuring espresso-soaked ladyfingers and rich mascarpone custard.',
        tips: 'Let espresso cool down to room temperature before dipping the ladyfingers.',
        preservation: 'Refrigerate tightly covered for up to 2 days.',
      },
      fr: {
        title: 'Tiramisu Italien Traditionnel',
        description:
          'Le grand classique italien à base de biscuits cuillère imbibés de café espresso et d’une crème onctueuse au mascarpone.',
        tips: 'Laissez le café refroidir complètement pour éviter d’amollir excessivement les biscuits.',
        preservation:
          'Se conserve au réfrigérateur sous film étirable jusqu’à 48 heures.',
      },
    },
    steps: [
      {
        duration: 15,
        translations: {
          it: {
            title: 'Montare la crema al mascarpone',
            description:
              'Lavora i tuorli con lo zucchero fino a renderli chiari e spumosi, poi incorpora il mascarpone e gli albumi montati a neve ferma.',
          },
          en: {
            title: 'Whip mascarpone cream',
            description:
              'Beat egg yolks and sugar until pale and thick, gently fold in mascarpone cheese followed by stiff egg whites.',
          },
          fr: {
            title: 'Préparer la crème au mascarpone',
            description:
              'Fouettez les jaunes avec le sucre, incorporez le mascarpone puis les blancs montés en neige ferme.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Stratificare e spolverare',
            description:
              'Inzuppa rapidamente i savoiardi nel caffè amaro e alternali con la crema in una pirofila. Concludi con una spolverata generosa di cacao.',
          },
          en: {
            title: 'Layer ladyfingers and dust',
            description:
              'Dip ladyfingers briefly into espresso, assemble alternating layers with cream, and dust generously with dark cocoa powder.',
          },
          fr: {
            title: 'Montage et saupoudrage',
            description:
              'Trempez rapidement les boudoirs dans le café, alternez les couches de biscuits et de crème, puis saupoudrez de cacao amer.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'ladyfingers', quantity: 300, unit: UnitOfMeasure.g },
      { slug: 'mascarpone', quantity: 500, unit: UnitOfMeasure.g },
      { slug: 'eggs', quantity: 4, unit: UnitOfMeasure.piece },
      {
        slug: 'coffee',
        quantity: 300,
        unit: UnitOfMeasure.ml,
        notes: {
          it: 'espresso amaro freddo',
          en: 'cold unsweetened espresso',
          fr: 'café espresso froid',
        },
      },
      { slug: 'sugar', quantity: 100, unit: UnitOfMeasure.g },
      { slug: 'cocoa', quantity: 30, unit: UnitOfMeasure.g },
    ],
    media: [
      {
        mediaType: MediaType.image,
        url: 'https://images.unsplash.com/photo-1586040140378-b5634cb4c8fc?w=800',
      },
    ],
  });

  // 3. Pizza Margherita Ufficiale (Main Course, Hard, 1455 min)
  const pizzaPlatform = await seedRecipe({
    ownerType: OwnerType.platform,
    course: Course.main_course,
    difficulty: RecipeDifficulty.hard,
    prepTime: 1440,
    cookTime: 15,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=800',
    videoUrl: 'https://www.youtube.com/watch?v=dummy_pizza',
    tagSlugs: ['traditional', 'vegetarian', 'comfort_food'],
    translations: {
      it: {
        title: 'Pizza Margherita Napoletana (Ricetta Ufficiale)',
        description:
          'La vera pizza napoletana a lievitazione lenta di 24 ore, con cornicione alveolato, pomodoro dolce e mozzarella di bufala campana.',
        tips: 'Inforna alla massima temperatura su pietra refrattaria preriscaldata.',
        preservation: 'Da gustare appena sfornata.',
      },
      en: {
        title: 'Official Neapolitan Pizza Margherita',
        description:
          'Artisanal 24-hour cold-fermented Neapolitan pizza with airy puffed crust, San Marzano tomato sauce, and creamy buffalo mozzarella.',
        tips: 'Bake on a blazing hot preheated pizza stone or baking steel.',
        preservation: 'Best enjoyed immediately fresh from the oven.',
      },
      fr: {
        title: 'Pizza Margherita Napolitaine (Recette Officielle)',
        description:
          'La véritable pizza napolitaine avec fermentation lente de 24h, croûte gonflée et alvéolée, sauce tomate et mozzarella de bufflonne.',
        tips: 'Enfournez à température maximale sur une pierre réfractaire très chaude.',
        preservation: 'À savourer dès la sortie du four.',
      },
    },
    steps: [
      {
        duration: 1440,
        translations: {
          it: {
            title: 'Impasto e maturazione',
            description:
              'Idrata la farina con acqua e lievito, incorda l’impasto e lascialo maturare in frigorifero per 24 ore.',
          },
          en: {
            title: 'Dough kneading and fermentation',
            description:
              'Knead flour, water, salt, and yeast until smooth. Cold ferment in the refrigerator for 24 hours.',
          },
          fr: {
            title: 'Pétrissage et fermentation',
            description:
              'Pétrissez la pâte jusqu’à consistance lisse et élastique. Laissez maturer 24 heures au frais.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Stesura e cottura ad alta temperatura',
            description:
              'Stendi i panetti a mano, condisci con pomodoro, mozzarella e basilico, e inforna a 250°C per 12 minuti.',
          },
          en: {
            title: 'Shape and bake',
            description:
              'Stretch dough by hand from center outward, top with crushed tomato, mozzarella, basil and olive oil, then bake at 250°C.',
          },
          fr: {
            title: 'Façonnage et cuisson',
            description:
              'Étalez la pâte au centre, garnissez de purée de tomates, mozzarella et basilic, puis enfournez à 250°C.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'flour', quantity: 500, unit: UnitOfMeasure.g },
      { slug: 'tomato', quantity: 250, unit: UnitOfMeasure.g },
      { slug: 'mozzarella', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'yeast', quantity: 3, unit: UnitOfMeasure.g },
      { slug: 'olive_oil', quantity: 20, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 12, unit: UnitOfMeasure.g },
      { slug: 'basil', quantity: 6, unit: UnitOfMeasure.piece },
    ],
  });

  // 4. Bruschetta al Pomodoro (Appetizer, Easy, 10 min)
  const bruschetta = await seedRecipe({
    authorId: userMario.id,
    course: Course.appetizer,
    difficulty: RecipeDifficulty.easy,
    prepTime: 7,
    cookTime: 3,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=800',
    tagSlugs: [
      'quick_easy',
      'vegan',
      'vegetarian',
      'summer',
      'budget_friendly',
    ],
    translations: {
      it: {
        title: 'Bruschetta Rustica al Pomodoro e Basilico',
        description:
          'Fette di pane casereccio tostate e strofinate con aglio fresco, condite con pomodori succosi tagliati a cubetti, basilico e olio evo.',
        tips: 'Taglia i pomodori e lasciali marinare 5 minuti con olio e sale prima di adagiarli sul pane.',
        preservation: 'Servire subito per mantenere il pane croccante.',
      },
      en: {
        title: 'Rustic Tomato & Basil Bruschetta',
        description:
          'Toasted artisan crusty bread rubbed with raw garlic and crowned with diced ripe tomatoes, fresh sweet basil, and extra virgin olive oil.',
        tips: 'Let diced tomatoes sit in olive oil and salt for 5 minutes before assembling.',
        preservation: 'Serve immediately to preserve crispy texture.',
      },
      fr: {
        title: 'Bruschetta Tomates & Basilic Frais',
        description:
          'Tranches de pain de campagne grillées, frottées à l’ail frais et garnies de dés de tomates juteuses, basilic et huile d’olive.',
        tips: 'Laissez mariner les tomates quelques minutes avec le sel et l’huile avant de dresser.',
        preservation:
          'À servir immédiatement pour garder le pain bien croustillant.',
      },
    },
    steps: [
      {
        duration: 5,
        translations: {
          it: {
            title: 'Condire i pomodori',
            description:
              'Taglia i pomodori a dadini piccoli, trita il basilico a mano e mescola con olio extravergine e sale.',
          },
          en: {
            title: 'Toss tomatoes',
            description:
              'Dice tomatoes into small cubes, tear fresh basil leaves, and toss with olive oil and a pinch of salt.',
          },
          fr: {
            title: 'Assaisonner les tomates',
            description:
              'Coupez les tomates en petits dés, ciselez le basilic et mélangez avec l’huile d’olive et le sel.',
          },
        },
      },
      {
        duration: 5,
        translations: {
          it: {
            title: 'Tostare il pane e comporre',
            description:
              'Tosta il pane in padella o al forno, strofina uno spicchio d’aglio sulle fette calde e distribuisci i pomodori.',
          },
          en: {
            title: 'Toast bread and assemble',
            description:
              'Toast rustic bread until golden, lightly rub warm slices with garlic clove, and spoon tomato mixture on top.',
          },
          fr: {
            title: 'Griller et dresser',
            description:
              'Faites griller les tranches de pain, frottez-les délicatement avec l’ail et déposez la garniture de tomates.',
          },
        },
      },
    ],
    ingredients: [
      {
        slug: 'bread',
        quantity: 4,
        unit: UnitOfMeasure.piece,
        notes: {
          it: 'fette spesse di pane casereccio',
          en: 'thick artisan bread slices',
          fr: 'tranches épaisses de pain',
        },
      },
      { slug: 'tomato', quantity: 300, unit: UnitOfMeasure.g },
      { slug: 'garlic', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'basil', quantity: 8, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 25, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 5. Guacamole Fresco (Snack, Easy, 12 min)
  const guacamole = await seedRecipe({
    authorId: userCarlos.id,
    course: Course.snack,
    difficulty: RecipeDifficulty.easy,
    prepTime: 12,
    cookTime: 0,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800',
    tagSlugs: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'quick_easy',
      'summer',
    ],
    translations: {
      it: {
        title: 'Guacamole Tradizionale Messicano',
        description:
          'Autentica crema di avocado schiacciata al mortaio con cipolla tritata fine, coriandolo, succo di lime fresco e pomodoro.',
        tips: 'Schiaccia gli avocado con una forchetta lasciando una consistenza rustica e non del tutto omogenea.',
        preservation:
          'Conservare a contatto con pellicola trasparente per evitare l’ossidazione.',
      },
      en: {
        title: 'Authentic Mexican Fresh Guacamole',
        description:
          'Creamy Hass avocados crushed with fresh lime juice, diced white onions, fragrant cilantro, and ripe red tomatoes.',
        tips: 'Mash avocados with a fork for a chunky texture rather than pureeing.',
        preservation:
          'Press plastic wrap directly onto the surface to prevent browning.',
      },
      fr: {
        title: 'Guacamole Frais Traditionnel',
        description:
          'Avocats écrasés à la fourchette relevés de jus de citron vert frais, coriandre parfumée, oignon doux et dés de tomate.',
        tips: 'Conservez une texture légèrement grumeleuse pour plus d’authenticité.',
        preservation:
          'Filmez au contact pour empêcher l’oxydation de l’avocat.',
      },
    },
    steps: [
      {
        duration: 6,
        translations: {
          it: {
            title: 'Tritare gli aromi',
            description:
              'Trita finemente cipolla e coriandolo fresco. Taglia a piccoli dadini il pomodoro.',
          },
          en: {
            title: 'Chop aromatics',
            description:
              'Finely dice onion and fresh cilantro leaves. Cut tomato into uniform small cubes.',
          },
          fr: {
            title: 'Émincer les aromates',
            description:
              'Hachez finement l’oignon et la coriandre fraîche. Coupez la tomate en petits dés.',
          },
        },
      },
      {
        duration: 6,
        translations: {
          it: {
            title: 'Schiacciare avocado e mescolare',
            description:
              'Estrai la polpa degli avocado maturi, irrora con succo di lime, unisci sale e amalgama con le verdure.',
          },
          en: {
            title: 'Mash and combine',
            description:
              'Scoop ripe avocados into a bowl, drizzle with lime juice, season with sea salt, and fold in vegetables.',
          },
          fr: {
            title: 'Écraser et mélanger',
            description:
              'Écrasez la chair des avocats avec le jus de lime et le sel, puis incorporez les aromates.',
          },
        },
      },
    ],
    ingredients: [
      {
        slug: 'avocado',
        quantity: 3,
        unit: UnitOfMeasure.piece,
        notes: {
          it: 'avocado Hass ben maturi',
          en: 'ripe Hass avocados',
          fr: 'avocats Hass mûrs',
        },
      },
      { slug: 'lime', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'cilantro', quantity: 10, unit: UnitOfMeasure.g },
      { slug: 'onion', quantity: 50, unit: UnitOfMeasure.g },
      { slug: 'tomato', quantity: 80, unit: UnitOfMeasure.g },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 6. Risotto ai Funghi Porcini (First Course, Medium, 35 min)
  const risotto = await seedRecipe({
    authorId: userMarco.id,
    course: Course.first_course,
    difficulty: RecipeDifficulty.medium,
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=800',
    tagSlugs: [
      'traditional',
      'vegetarian',
      'gluten_free',
      'winter',
      'comfort_food',
    ],
    translations: {
      it: {
        title: 'Risotto Cremoso ai Funghi Porcini',
        description:
          'Un grande classico della cucina italiana: riso Carnaroli tostato a secco, sfumato con vino bianco e mantecato con burro e Parmigiano Reggiano.',
        tips: 'Manteca all’onda a fuoco spento lasciando riposare due minuti prima di impiattare.',
        preservation: 'Consumare caldo subito.',
      },
      en: {
        title: 'Creamy Porcini Mushroom Risotto',
        description:
          'Velvety Italian Carnaroli risotto infused with aromatic porcini mushrooms, dry white wine, butter, and aged Parmigiano Reggiano.',
        tips: 'Beat cold butter and cheese off the heat for maximum silkiness and shine.',
        preservation: 'Serve immediately.',
      },
      fr: {
        title: 'Risotto Crémeux aux Cèpes',
        description:
          'Un chef-d’œuvre de la gastronomie italienne : riz Carnaroli nacré, déglacé au vin blanc sec et lié au beurre doux et parmesan.',
        tips: 'Liez le risotto hors du feu avec du beurre bien froid pour une onctuosité parfaite.',
        preservation: 'À consommer sans attendre.',
      },
    },
    steps: [
      {
        duration: 10,
        translations: {
          it: {
            title: 'Trifolare i funghi e tostare il riso',
            description:
              'Salta i porcini a fette con un filo d’olio. In una casseruola tosta il riso a secco fino a renderlo traslucido.',
          },
          en: {
            title: 'Sauté mushrooms and toast rice',
            description:
              'Quickly sauté sliced porcini in olive oil. In a separate pan, toast rice until hot and translucent.',
          },
          fr: {
            title: 'Poêler les cèpes et nacrer le riz',
            description:
              'Poêlez les cèpes à feu vif. Dans une casserole, nacrez le riz à sec jusqu’à translucidité.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Cottura con brodo',
            description:
              'Sfuma con vino bianco, lascia evaporare e prosegui la cottura aggiungendo brodo caldo poco alla volta.',
          },
          en: {
            title: 'Simmer with broth',
            description:
              'Deglaze with white wine, allow to evaporate, and gradually ladle hot stock while stirring.',
          },
          fr: {
            title: 'Mouiller et cuire',
            description:
              'Déglacez au vin blanc, laissez réduire et incorporez le bouillon chaud louche après louche.',
          },
        },
      },
      {
        duration: 5,
        translations: {
          it: {
            title: 'Mantecatura finale',
            description:
              'Aggiungi i porcini, spegni il fuoco e manteca vigorosamente con burro freddo e Parmigiano.',
          },
          en: {
            title: 'Final mantecatura',
            description:
              'Stir in sautéed mushrooms, turn off heat, and vigorously stir in cold butter and parmesan.',
          },
          fr: {
            title: 'Liaison finale',
            description:
              'Ajoutez les cèpes, retirez du feu et incorporez vigoureusement le beurre froid et le parmesan.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'rice', quantity: 320, unit: UnitOfMeasure.g },
      { slug: 'mushrooms', quantity: 250, unit: UnitOfMeasure.g },
      { slug: 'white_wine', quantity: 100, unit: UnitOfMeasure.ml },
      { slug: 'butter', quantity: 40, unit: UnitOfMeasure.g },
      { slug: 'parmesan', quantity: 60, unit: UnitOfMeasure.g },
      { slug: 'onion', quantity: 40, unit: UnitOfMeasure.g },
      { slug: 'olive_oil', quantity: 20, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 7. Zuppa di Lenticchie e Rosmarino (First Course, Easy, 45 min)
  const lentilsSoup = await seedRecipe({
    authorId: userElena.id,
    course: Course.first_course,
    difficulty: RecipeDifficulty.easy,
    prepTime: 10,
    cookTime: 35,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800',
    tagSlugs: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'budget_friendly',
      'winter',
      'comfort_food',
    ],
    translations: {
      it: {
        title: 'Zuppa Rustica di Lenticchie e Rosmarino',
        description:
          'Un piatto caldo e nutriente preparato con lenticchie marroni, soffritto di carote, cipolla e un generoso rametto di rosmarino fresco.',
        tips: 'Aggiungi il sale solo a fine cottura per evitare che la buccia delle lenticchie si indurisca.',
        preservation:
          'Ottima anche il giorno dopo, si conserva in frigo per 3 giorni.',
      },
      en: {
        title: 'Rustic Rosemary & Lentil Soup',
        description:
          'Wholesome winter comfort soup made with tender lentils, mirepoix vegetables, garlic, and fresh rosemary sprigs.',
        tips: 'Salt the soup only at the very end so lentil skins stay soft.',
        preservation: 'Stores wonderfully in the fridge for up to 3 days.',
      },
      fr: {
        title: 'Soupe Rustique de Lentilles au Romarin',
        description:
          'Une soupe d’hiver réconfortante et équilibrée à base de lentilles mijotées avec carottes, oignons et romarin frais.',
        tips: 'Salez en toute fin de cuisson pour que les lentilles restent tendres.',
        preservation:
          'Encore meilleure réchauffée le lendemain, se garde 3 jours au frais.',
      },
    },
    steps: [
      {
        duration: 10,
        translations: {
          it: {
            title: 'Soffritto aromatico',
            description:
              'Fai appassire dolcemente cipolla, aglio e carote tagliate a piccoli cubetti nell’olio con il rosmarino.',
          },
          en: {
            title: 'Sauté mirepoix',
            description:
              'Gently sweat finely diced carrots, onions, garlic and rosemary sprig in olive oil.',
          },
          fr: {
            title: 'Faire suer la garniture',
            description:
              'Faites suer doucement les carottes, oignons, ail et le brin de romarin dans l’huile d’olive.',
          },
        },
      },
      {
        duration: 35,
        translations: {
          it: {
            title: 'Cottura delle lenticchie',
            description:
              'Aggiungi le lenticchie sciacquate, copri con acqua bollente o brodo vegetale e lascia sobbollire dolcemente per 35 minuti.',
          },
          en: {
            title: 'Simmer lentils',
            description:
              'Rinse lentils, add to pot, cover with water or vegetable broth, and simmer gently for 35 minutes until tender.',
          },
          fr: {
            title: 'Mijoter les lentilles',
            description:
              'Rincez les lentilles, couvrez d’eau bouillante et laissez mijoter 35 minutes à feu doux.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'lentils', quantity: 280, unit: UnitOfMeasure.g },
      { slug: 'carrots', quantity: 120, unit: UnitOfMeasure.g },
      { slug: 'onion', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'garlic', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'rosemary', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 30, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
      { slug: 'black_pepper', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 8. Salmone al Forno con Limone (Main Course, Easy, 25 min)
  const salmonDish = await seedRecipe({
    authorId: userGiulia.id,
    course: Course.main_course,
    difficulty: RecipeDifficulty.easy,
    prepTime: 10,
    cookTime: 15,
    servings: 2,
    coverImageUrl:
      'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800',
    tagSlugs: ['gluten_free', 'dairy_free', 'low_carb', 'quick_easy', 'summer'],
    translations: {
      it: {
        title: 'Trancio di Salmone al Forno con Limone',
        description:
          'Tranci di salmone teneri e succosi cotti al cartoccio con fette di limone, aglio dolce, pepe nero e un filo d’olio extravergine.',
        tips: 'Non superare i 15 minuti di cottura a 180°C per evitare di asciugare il cuore del pesce.',
        preservation: 'Consumare caldo appena sfornato.',
      },
      en: {
        title: 'Baked Lemon & Herb Salmon Fillet',
        description:
          'Tender salmon fillets baked with fresh lemon slices, crushed garlic, cracked black pepper, and premium olive oil.',
        tips: 'Do not overcook: 12-15 minutes at 180°C keeps the flesh tender and flakey.',
        preservation: 'Best served freshly baked.',
      },
      fr: {
        title: 'Pavé de Saumon Rôti au Citron',
        description:
          'Pavés de saumon fondants cuits au four sous des rondelles de citron frais, ail doux et filet d’huile d’olive extra vierge.',
        tips: 'Ne dépassez pas 15 minutes de cuisson à 180°C pour garder un cœur nacré.',
        preservation: 'Déguster dès la sortie du four.',
      },
    },
    steps: [
      {
        duration: 5,
        translations: {
          it: {
            title: 'Preparare il salmone',
            description:
              'Disponi i filetti di salmone su una teglia con carta forno, adagia sopra le fettine di limone e l’aglio.',
          },
          en: {
            title: 'Prep salmon fillets',
            description:
              'Place salmon fillets skin-side down on parchment paper, top with lemon slices and minced garlic.',
          },
          fr: {
            title: 'Préparer le poisson',
            description:
              'Déposez les pavés de saumon sur une plaque chemisée de papier sulfurisé, garnissez de rondelles de citron.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Cottura in forno',
            description:
              'Irrora con olio, spolvera di sale e pepe e inforna a 180°C per 14-15 minuti finché la carne è sfogliabile.',
          },
          en: {
            title: 'Bake to perfection',
            description:
              'Drizzle with olive oil, season with salt and pepper, and bake at 180°C for 14-15 minutes.',
          },
          fr: {
            title: 'Enfourner',
            description:
              'Arrosez d’huile d’olive, assaisonnez de sel et poivre et cuisez à 180°C pendant 15 minutes.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'salmon', quantity: 360, unit: UnitOfMeasure.g },
      { slug: 'lemon', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'garlic', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 20, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
      { slug: 'black_pepper', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 9. Pollo al Curry con Latte di Cocco (Main Course, Medium, 40 min)
  const chickenCurry = await seedRecipe({
    authorId: userKenji.id,
    course: Course.main_course,
    difficulty: RecipeDifficulty.medium,
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=800',
    tagSlugs: ['dairy_free', 'gluten_free', 'comfort_food', 'winter'],
    translations: {
      it: {
        title: 'Bocconcini di Pollo al Curry con Latte di Cocco',
        description:
          'Bocconcini di petto di pollo rosolati con spezie dolci e cotti dolcemente in una salsa ricca a base di latte di cocco e cipolla.',
        tips: 'Accompagna con riso basmati al vapore per raccogliere la gustosa salsa.',
        preservation:
          'Conservare in frigo in contenitore ermetico fino a 2 giorni.',
      },
      en: {
        title: 'Creamy Coconut Chicken Curry',
        description:
          'Succulent chicken breast bites simmered in rich coconut milk infused with aromatic curry spices, onions, and garlic.',
        tips: 'Pair with steamed jasmine or basmati rice to soak up the luxurious sauce.',
        preservation: 'Refrigerate in an airtight container for up to 2 days.',
      },
      fr: {
        title: 'Poulet au Curry et Lait de Coco',
        description:
          'Émincé de poulet doré aux épices et mijoté dans une sauce onctueuse au lait de coco, oignons fondants et ail.',
        tips: 'Accompagnez d’un bol de riz parfumé cuit à la vapeur.',
        preservation:
          'Se conserve 2 jours au réfrigérateur dans une boîte hermétique.',
      },
    },
    steps: [
      {
        duration: 10,
        translations: {
          it: {
            title: 'Rosolare il pollo',
            description:
              'Taglia il pollo a cubetti e rosolalo in padella a fuoco vivace con un filo d’olio finché è sigillato.',
          },
          en: {
            title: 'Sear chicken',
            description:
              'Cut chicken into bite-sized cubes and sear in hot oil until lightly browned on all sides.',
          },
          fr: {
            title: 'Saisir le poulet',
            description:
              'Coupez le blanc de poulet en dés et saisissez-le à feu vif dans un filet d’huile d’olive.',
          },
        },
      },
      {
        duration: 20,
        translations: {
          it: {
            title: 'Sfumare con spezie e cocco',
            description:
              'Aggiungi cipolla tritata, aglio e curry in polvere. Tosta le spezie un minuto, poi versa il latte di cocco e lascia addensare.',
          },
          en: {
            title: 'Simmer with coconut milk',
            description:
              'Add minced onions, garlic, and curry powder. Stir for 1 minute then pour coconut milk and simmer until thick.',
          },
          fr: {
            title: 'Mijoter au lait de coco',
            description:
              'Ajoutez les oignons, l’ail et le curry. Faites torréfier 1 minute puis versez le lait de coco et laissez réduire.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'chicken_breast', quantity: 500, unit: UnitOfMeasure.g },
      { slug: 'coconut_milk', quantity: 350, unit: UnitOfMeasure.ml },
      { slug: 'curry_powder', quantity: 2, unit: UnitOfMeasure.tbsp },
      { slug: 'onion', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'garlic', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 20, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 10. Boeuf Bourguignon (Main Course, Hard, 195 min)
  const boeufBourguignon = await seedRecipe({
    authorId: userSophie.id,
    course: Course.main_course,
    difficulty: RecipeDifficulty.hard,
    prepTime: 30,
    cookTime: 165,
    servings: 6,
    coverImageUrl:
      'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=800',
    tagSlugs: ['traditional', 'comfort_food', 'dairy_free', 'winter'],
    translations: {
      it: {
        title: 'Boeuf Bourguignon Tradizionale Francese',
        description:
          'La quintessenza della cucina francese: teneri bocconcini di manzo brasati lentamente nel vino rosso corposo con carote, cipolla e funghi.',
        tips: 'La cottura lentissima a fiamma dolce è il segreto per sciogliere il collagene della carne.',
        preservation: 'Riscaldato il giorno seguente è ancora più delizioso.',
      },
      en: {
        title: 'Classic French Boeuf Bourguignon',
        description:
          'Legendary French beef stew slow-cooked in robust red wine with glazed carrots, onions, aromatic herbs, and savory mushrooms.',
        tips: 'Slow braising at a gentle simmer breaks down connective tissue for melt-in-your-mouth beef.',
        preservation:
          'Flavors deepen overnight; excellent reheated the next day.',
      },
      fr: {
        title: 'Bœuf Bourguignon de Tradition',
        description:
          'Le chef-d’œuvre de la cuisine bourguignonne : morceaux de bœuf marinés et mijotés longuement au vin rouge avec carottes et champignons.',
        tips: 'Une cuisson très douce et prolongée garantit une viande fondante à cœur.',
        preservation: 'Encore meilleur réchauffé le lendemain.',
      },
    },
    steps: [
      {
        duration: 20,
        translations: {
          it: {
            title: 'Sigillare la carne',
            description:
              'Asciuga i cubi di manzo e rosolali in una casseruola capiente in ghisa con olio finché formano una crosticina scura.',
          },
          en: {
            title: 'Brown beef pieces',
            description:
              'Pat beef chunks dry and sear in a heavy Dutch oven until deeply caramelized on all sides.',
          },
          fr: {
            title: 'Colorer la viande',
            description:
              'Salez et saisissez les morceaux de bœuf dans une cocotte en fonte jusqu’à belle coloration dorée.',
          },
        },
      },
      {
        duration: 150,
        translations: {
          it: {
            title: 'Brasatura lenta nel vino rosso',
            description:
              'Aggiungi carote, cipolla, aglio e un cucchiaio di farina. Copri interamente con il vino rosso e cuoci a fuoco lentissimo per oltre due ore.',
          },
          en: {
            title: 'Slow braise in wine',
            description:
              'Stir in carrots, onions, garlic and dust with flour. Submerge with red wine and braise gently on low heat for 2.5 hours.',
          },
          fr: {
            title: 'Mijotage au vin rouge',
            description:
              'Ajoutez les carottes, oignons, saupoudrez d’une cuillère de farine, mouillez au vin rouge et laissez mijoter 2h30.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Aggiungere i funghi',
            description:
              'Unisci i funghi trifolati negli ultimi 15 minuti di cottura per completare la salsa vellutata.',
          },
          en: {
            title: 'Fold in mushrooms',
            description:
              'Fold sautéed mushrooms into the pot during the last 15 minutes of cooking.',
          },
          fr: {
            title: 'Finir avec les champignons',
            description:
              'Ajoutez les champignons poêlés 15 minutes avant la fin de la cuisson pour parfaire la sauce.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'beef_chuck', quantity: 900, unit: UnitOfMeasure.g },
      { slug: 'red_wine', quantity: 500, unit: UnitOfMeasure.ml },
      { slug: 'carrots', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'mushrooms', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'onion', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'garlic', quantity: 3, unit: UnitOfMeasure.piece },
      { slug: 'flour', quantity: 20, unit: UnitOfMeasure.g },
      { slug: 'olive_oil', quantity: 30, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 11. Insalata Caprese (Side Dish, Easy, 10 min)
  const caprese = await seedRecipe({
    authorId: userMario.id,
    course: Course.side_dish,
    difficulty: RecipeDifficulty.easy,
    prepTime: 10,
    cookTime: 0,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1592417817098-8f3d6910985c?w=800',
    tagSlugs: ['vegetarian', 'gluten_free', 'quick_easy', 'summer', 'low_carb'],
    translations: {
      it: {
        title: 'Insalata Caprese con Mozzarella di Bufala',
        description:
          'L’essenza dell’estate mediterranea: fette di pomodori maturi alternate a mozzarella di bufala fresca, foglie di basilico e olio evo fruttato.',
        tips: 'Servire a temperatura ambiente per apprezzare appieno il sapore e la cremosità della mozzarella.',
        preservation: 'Consumare fresca al momento.',
      },
      en: {
        title: 'Traditional Caprese Salad with Buffalo Mozzarella',
        description:
          'Vibrant Italian summer salad composed of sliced sweet tomatoes, creamy buffalo mozzarella, fragrant basil leaves, and cold-pressed olive oil.',
        tips: 'Always serve at room temperature to let the cheese release its delicate milkiness.',
        preservation: 'Enjoy fresh within a few hours.',
      },
      fr: {
        title: 'Salade Caprese à la Mozzarella de Bufflonne',
        description:
          'L’incontournable salade d’été composée de tomates mûres en rondelles, mozzarella de bufflonne crémeuse et basilic frais.',
        tips: 'Servez à température ambiante pour libérer toutes les saveurs du fromage.',
        preservation: 'À consommer fraîchement préparée.',
      },
    },
    steps: [
      {
        duration: 10,
        translations: {
          it: {
            title: 'Tagliare e comporre',
            description:
              'Affetta i pomodori e la mozzarella a fette di uguale spessore. Disponili alternati su un piatto da portata con foglie di basilico.',
          },
          en: {
            title: 'Slice and arrange',
            description:
              'Slice tomatoes and mozzarella into even rounds. Alternate slices on a serving platter with fresh basil.',
          },
          fr: {
            title: 'Trancher et dresser',
            description:
              'Coupez tomates et mozzarella en rondelles régulières et disposez-les en alternance avec le basilic.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'tomato', quantity: 400, unit: UnitOfMeasure.g },
      { slug: 'mozzarella', quantity: 250, unit: UnitOfMeasure.g },
      { slug: 'basil', quantity: 12, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 30, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 12. Patate al Forno con Rosmarino (Side Dish, Easy, 50 min)
  const bakedPotatoes = await seedRecipe({
    authorId: userMarco.id,
    course: Course.side_dish,
    difficulty: RecipeDifficulty.easy,
    prepTime: 10,
    cookTime: 40,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800',
    tagSlugs: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'budget_friendly',
      'comfort_food',
    ],
    translations: {
      it: {
        title: 'Patate al Forno Croccanti con Rosmarino e Aglio',
        description:
          'Cubotti di patate croccanti fuori e morbidissimi dentro, aromatizzati con aghi di rosmarino fresco, spicchi d’aglio in camicia e pepe nero.',
        tips: 'Sbollenta le patate tagliate per 5 minuti prima di infornarle per una crosta super croccante.',
        preservation: 'Consumare calde e croccanti appena sfornate.',
      },
      en: {
        title: 'Crispy Garlic & Rosemary Roast Potatoes',
        description:
          'Golden-crusted roasted potato wedges fluffy on the inside, tossed in olive oil, fresh rosemary, sea salt, and unpeeled garlic cloves.',
        tips: 'Parboil potato cubes for 5 minutes before roasting for maximum crispiness.',
        preservation: 'Best served immediately hot from the oven.',
      },
      fr: {
        title: 'Pommes de Terre Rôties au Romarin et à l’Ail',
        description:
          'Dés de pommes de terre croustillants à l’extérieur et fondants à l’intérieur, parfumés au romarin frais et à l’huile d’olive.',
        tips: 'Précuisez les pommes de terre 5 minutes à l’eau bouillante pour une croûte ultra croustillante.',
        preservation: 'À savourer bien chaudes.',
      },
    },
    steps: [
      {
        duration: 10,
        translations: {
          it: {
            title: 'Tagliare e condire',
            description:
              'Pela le patate, tagliale a cubi regolari e condiscile generosamente con olio, aghi di rosmarino, aglio e sale.',
          },
          en: {
            title: 'Chop and season',
            description:
              'Peel potatoes, cut into bite-sized cubes, and toss vigorously with olive oil, fresh rosemary, crushed garlic, and sea salt.',
          },
          fr: {
            title: 'Découper et assaisonner',
            description:
              'Pelez les pommes de terre, taillez-les en dés et enrobez-les d’huile d’olive, romarin et ail.',
          },
        },
      },
      {
        duration: 40,
        translations: {
          it: {
            title: 'Cottura in forno ventilato',
            description:
              'Disponi in un unico strato su teglia e cuoci a 200°C per 40 minuti girandole a metà cottura.',
          },
          en: {
            title: 'Roast until golden',
            description:
              'Spread evenly on a baking tray and roast at 200°C for 40 minutes, flipping once halfway.',
          },
          fr: {
            title: 'Rôtir au four',
            description:
              'Étalez sur une plaque et faites rôtir à 200°C pendant 40 minutes en remuant à mi-cuisson.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'potatoes', quantity: 800, unit: UnitOfMeasure.g },
      { slug: 'rosemary', quantity: 3, unit: UnitOfMeasure.piece },
      { slug: 'garlic', quantity: 3, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 40, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
      { slug: 'black_pepper', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 13. Ratatouille Provenzale (Side Dish, Medium, 65 min)
  const ratatouille = await seedRecipe({
    authorId: userSophie.id,
    course: Course.side_dish,
    difficulty: RecipeDifficulty.medium,
    prepTime: 25,
    cookTime: 40,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1572453800999-e8d2d1589b7c?w=800',
    tagSlugs: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'traditional',
      'summer',
    ],
    translations: {
      it: {
        title: 'Ratatouille Provenzale al Forno',
        description:
          'La celebre specialità francese a base di rondelle sottili di melanzane, zucchine e pomodori cotti lentamente su un letto di peperoni e cipolle.',
        tips: 'Taglia tutte le verdure allo stesso spessore per una cottura uniforme ed esteticamente perfetta.',
        preservation:
          'Si conserva 2 giorni in frigorifero; deliziosa anche tiepida.',
      },
      en: {
        title: 'Classic Provençal Baked Ratatouille',
        description:
          'Traditional southern French vegetable casserole layering delicate slices of eggplant, zucchini, and tomatoes over a savory pepper base.',
        tips: 'Slice vegetables with a mandoline for uniform cooking and an elegant presentation.',
        preservation:
          'Keeps well in the fridge for up to 2 days; wonderful served warm.',
      },
      fr: {
        title: 'Ratatouille Provençale Traditionnelle',
        description:
          'Rondelles fines d’aubergines, courgettes et tomates cuites au four sur un coulis parfumé d’oignons et poivrons.',
        tips: 'Taillez les légumes à la mandoline pour un rendu régulier et harmonieux.',
        preservation: 'Délicieuse tiède, se conserve 48h au réfrigérateur.',
      },
    },
    steps: [
      {
        duration: 15,
        translations: {
          it: {
            title: 'Preparare la base di peperoni',
            description:
              'Stufa cipolla, aglio e peperoni a cubetti in padella con olio fino a ottenere una salsa aromatica da stendere sulla teglia.',
          },
          en: {
            title: 'Prepare bell pepper base',
            description:
              'Sauté onions, garlic, and diced bell peppers in olive oil until soft, then spread across baking dish.',
          },
          fr: {
            title: 'Préparer le lit de légumes',
            description:
              'Faites revenir oignons, ail et poivrons à l’huile d’olive et tapissez le fond du plat à gratin.',
          },
        },
      },
      {
        duration: 45,
        translations: {
          it: {
            title: 'Disporre le verdure e infornare',
            description:
              'Disponi le fette di zucchina, melanzana e pomodoro a spirale, condisci con olio ed erbe e inforna a 180°C per 40 minuti.',
          },
          en: {
            title: 'Arrange and bake',
            description:
              'Fan alternating slices of zucchini, eggplant, and tomato in concentric circles, drizzle with olive oil, and bake at 180°C.',
          },
          fr: {
            title: 'Dresser en rosace et cuire',
            description:
              'Disposez les tranches de légumes en spirale, arrosez d’huile d’olive et enfournez à 180°C pendant 40 minutes.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'eggplant', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'zucchini', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'tomato', quantity: 3, unit: UnitOfMeasure.piece },
      { slug: 'bell_pepper', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'onion', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'garlic', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 30, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 14. Fondant al Cioccolato (Dessert, Medium, 25 min)
  const fondant = await seedRecipe({
    authorId: userSophie.id,
    course: Course.dessert,
    difficulty: RecipeDifficulty.medium,
    prepTime: 15,
    cookTime: 10,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800',
    tagSlugs: ['vegetarian', 'comfort_food', 'nut_free'],
    translations: {
      it: {
        title: 'Tortino al Cioccolato dal Cuore Morbido',
        description:
          'Dolce monoporzione irresistibile con esterno soffice al cioccolato fondente 70% e un cuore caldo cremoso e fondente.',
        tips: 'Controlla con precisione il tempo di cottura: 9-10 minuti a 190°C per garantire il cuore liquido.',
        preservation: 'Servire subito caldo.',
      },
      en: {
        title: 'Molten Dark Chocolate Lava Cake',
        description:
          'Decadent individual chocolate cakes with a tender sponge exterior and an oozing warm chocolate center.',
        tips: 'Bake precisely for 9 to 10 minutes at 190°C to preserve the molten liquid core.',
        preservation: 'Serve immediately right out of the ramekins.',
      },
      fr: {
        title: 'Coulant au Chocolat Noir et Cœur Fondant',
        description:
          'Le gâteau individuel par excellence, offrant une croûte délicate et un cœur de chocolat noir chaud intensément coulant.',
        tips: 'Surveillez la cuisson à la minute près : 9 à 10 minutes à 190°C.',
        preservation: 'À déguster aussitôt démoulé.',
      },
    },
    steps: [
      {
        duration: 10,
        translations: {
          it: {
            title: 'Fondere cioccolato e burro',
            description:
              'Sciogli il cioccolato fondente a bagnomaria con il burro fino a ottenere una crema lucida e omogenea.',
          },
          en: {
            title: 'Melt chocolate and butter',
            description:
              'Gently melt dark chocolate and butter over a double boiler until smooth and glossy.',
          },
          fr: {
            title: 'Fondre le chocolat',
            description:
              'Faites fondre le chocolat noir et le beurre au bain-marie jusqu’à obtention d’une pâte lisse.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Amalgamare e infornare',
            description:
              'Monta uova e zucchero, unisci il cioccolato fuso, incorpora la farina, versa nei pirottini e inforna a 190°C per 10 minuti.',
          },
          en: {
            title: 'Whisk batter and bake',
            description:
              'Beat eggs with sugar, stir into melted chocolate, fold in flour, pour into greased ramekins, and bake at 190°C for 10 min.',
          },
          fr: {
            title: 'Mélanger et cuire',
            description:
              'Fouettez œufs et sucre, ajoutez le chocolat fondu et la farine. Versez dans les moules et cuisez 10 minutes à 190°C.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'dark_chocolate', quantity: 150, unit: UnitOfMeasure.g },
      { slug: 'butter', quantity: 100, unit: UnitOfMeasure.g },
      { slug: 'eggs', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'sugar', quantity: 60, unit: UnitOfMeasure.g },
      { slug: 'flour', quantity: 30, unit: UnitOfMeasure.g },
    ],
  });

  // 15. Chia Pudding ai Frutti di Bosco (Dessert, Easy, 15 min)
  const chiaPudding = await seedRecipe({
    authorId: userElena.id,
    course: Course.dessert,
    difficulty: RecipeDifficulty.easy,
    prepTime: 15,
    cookTime: 0,
    servings: 2,
    coverImageUrl:
      'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=800',
    tagSlugs: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'nut_free',
      'summer',
    ],
    translations: {
      it: {
        title: 'Chia Pudding al Latte di Cocco e Frutti di Bosco',
        description:
          'Dessert fresco e salutare a base di semi di chia idratati nel latte di cocco profumato alla vaniglia, guarnito con coulis di frutti di bosco.',
        tips: 'Lascia riposare almeno 2 ore in frigo affinché i semi rilascino il naturale gel gelatinoso.',
        preservation:
          'Si conserva fino a 3 giorni in frigorifero in barattolini chiusi.',
      },
      en: {
        title: 'Vanilla Berry Chia Seed Pudding',
        description:
          'Refreshing vegan dessert cup prepared with chia seeds bloomed in rich vanilla coconut milk, topped with vibrant mixed berry compote.',
        tips: 'Refrigerate for at least 2 hours to achieve a thick, custard-like consistency.',
        preservation: 'Keep refrigerated in sealed jars for up to 3 days.',
      },
      fr: {
        title: 'Pudding de Chia au Lait de Coco et Baies',
        description:
          'Un dessert sain et gourmand à base de graines de chia infusées au lait de coco vanillé, surmonté d’un coulis de fruits rouges.',
        tips: 'Laissez reposer au frais au minimum 2 heures pour que les graines gonflent bien.',
        preservation:
          'Se conserve au frais dans des bocaux hermétiques jusqu’à 3 jours.',
      },
    },
    steps: [
      {
        duration: 5,
        translations: {
          it: {
            title: 'Idratare i semi di chia',
            description:
              'Mescola energicamente i semi di chia con il latte di cocco, lo zucchero e l’estratto di vaniglia per evitare grumi.',
          },
          en: {
            title: 'Whisk seeds and milk',
            description:
              'Whisk chia seeds into coconut milk with sugar and vanilla extract until completely dispersed.',
          },
          fr: {
            title: 'Mélanger graines et lait',
            description:
              'Fouettez les graines de chia dans le lait de coco avec le sucre et l’extrait de vanille.',
          },
        },
      },
      {
        duration: 10,
        translations: {
          it: {
            title: 'Riposo e guarnizione',
            description:
              'Riponi in frigorifero a rassodare, poi guarnisci con frutti di bosco freschi prima di servire.',
          },
          en: {
            title: 'Chill and garnish',
            description:
              'Chill in the fridge until set, then top with fresh mixed berries before serving.',
          },
          fr: {
            title: 'Réfrigérer et garnir',
            description:
              'Placez au réfrigérateur pour faire prendre, puis déposez les fruits rouges frais au moment de servir.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'chia_seeds', quantity: 50, unit: UnitOfMeasure.g },
      { slug: 'coconut_milk', quantity: 250, unit: UnitOfMeasure.ml },
      { slug: 'berries', quantity: 100, unit: UnitOfMeasure.g },
      { slug: 'sugar', quantity: 20, unit: UnitOfMeasure.g },
      { slug: 'vanilla', quantity: 1, unit: UnitOfMeasure.tsp },
    ],
  });

  // 16. Smoothie Energetico Banana e Noci (Drink, Easy, 5 min)
  const smoothie = await seedRecipe({
    authorId: userElena.id,
    course: Course.drink,
    difficulty: RecipeDifficulty.easy,
    prepTime: 5,
    cookTime: 0,
    servings: 2,
    coverImageUrl:
      'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=800',
    tagSlugs: ['vegetarian', 'quick_easy', 'budget_friendly', 'summer'],
    translations: {
      it: {
        title: 'Smoothie Energetico con Banana e Noci',
        description:
          'Frullato vellutato e corroborante a base di banana matura, gherigli di noce, latte fresco e un tocco di vaniglia aromatica.',
        tips: 'Usa una banana congelata a rondelle per ottenere una consistenza ancora più densa e rinfrescante.',
        preservation: 'Da bere subito per preservare tutti i nutrienti.',
      },
      en: {
        title: 'Banana & Walnut Energy Smoothie',
        description:
          'Thick, energizing breakfast smoothie blending ripe bananas, crunchy walnuts, cold milk, and natural vanilla.',
        tips: 'Use frozen sliced bananas for a creamy, milkshake-like texture without adding ice.',
        preservation: 'Enjoy immediately after blending.',
      },
      fr: {
        title: 'Smoothie Énergétique Banane & Noix',
        description:
          'Boisson douce et revigorante associant banane mûre, cerneaux de noix, lait frais et pointe de vanille.',
        tips: 'Utilisez des rondelles de banane congelées pour une consistance glacée très onctueuse.',
        preservation: 'À consommer sans attendre.',
      },
    },
    steps: [
      {
        duration: 5,
        translations: {
          it: {
            title: 'Frullare tutti gli ingredienti',
            description:
              'Inserisci nel frullatore la banana a pezzi, le noci, il latte e la vaniglia. Frulla alla massima velocità per 60 secondi.',
          },
          en: {
            title: 'Blend smooth',
            description:
              'Combine banana chunks, walnuts, milk, and vanilla in a blender. Blend on high for 60 seconds until silky smooth.',
          },
          fr: {
            title: 'Mixer le tout',
            description:
              'Mettez les morceaux de banane, les noix, le lait et la vanille dans le blender. Mixez à pleine puissance pendant 1 minute.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'banana', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'walnuts', quantity: 40, unit: UnitOfMeasure.g },
      { slug: 'milk', quantity: 300, unit: UnitOfMeasure.ml },
      { slug: 'vanilla', quantity: 1, unit: UnitOfMeasure.tsp },
    ],
  });

  // 17. Espresso Martini (Drink, Medium, 7 min)
  const espressoMartini = await seedRecipe({
    authorId: userMarco.id,
    course: Course.drink,
    difficulty: RecipeDifficulty.medium,
    prepTime: 7,
    cookTime: 0,
    servings: 2,
    coverImageUrl:
      'https://images.unsplash.com/photo-1545438102-799c3991ffb2?w=800',
    tagSlugs: [
      'dairy_free',
      'gluten_free',
      'nut_free',
      'quick_easy',
      'traditional',
    ],
    translations: {
      it: {
        title: 'Espresso Martini d’Autore',
        description:
          'Sofisticato cocktail da dopocena che combina l’intensità del caffè espresso appena fatto con vodka liscia e liquore al caffè.',
        tips: 'Shakera energicamente con tanto ghiaccio per 15 secondi per creare la caratteristica schiuma densa in superficie.',
        preservation: 'Servire ghiacciato subito.',
      },
      en: {
        title: 'Signature Espresso Martini Cocktail',
        description:
          'Sophisticated modern classic cocktail blending hot freshly pulled espresso, premium vodka, and velvety coffee liqueur.',
        tips: 'Shake vigorously with plenty of ice for 15 seconds to create the iconic thick crema on top.',
        preservation: 'Serve immediately chilled in martini glasses.',
      },
      fr: {
        title: 'Cocktail Espresso Martini Raffiné',
        description:
          'L’incontournable cocktail d’après-dîner mariant la puissance d’un espresso serré, de la vodka pure et de la liqueur de café.',
        tips: 'Secouez vigoureusement au shaker avec beaucoup de glace pour obtenir une mousse dense et crémeuse.',
        preservation: 'À servir immédiatement glacé dans une coupe à cocktail.',
      },
    },
    steps: [
      {
        duration: 7,
        translations: {
          it: {
            title: 'Shakerare e filtrare',
            description:
              'Versa nello shaker ghiaccio, vodka, liquore al caffè, caffè espresso caldo e zucchero liquido. Shakera con forza e versa filtrando in coppa.',
          },
          en: {
            title: 'Shake and strain',
            description:
              'Add ice, vodka, coffee liqueur, freshly brewed hot espresso, and simple syrup to shaker. Shake hard and fine-strain into glasses.',
          },
          fr: {
            title: 'Shaker et filtrer',
            description:
              'Versez les ingrédients et la glace dans le shaker. Secouez vigoureusement et filtrez dans les verres refroidis.',
          },
        },
      },
    ],
    ingredients: [
      {
        slug: 'coffee',
        quantity: 60,
        unit: UnitOfMeasure.ml,
        notes: {
          it: 'espresso appena estratto',
          en: 'freshly pulled espresso',
          fr: 'espresso chaud fraîchement extrait',
        },
      },
      { slug: 'vodka', quantity: 100, unit: UnitOfMeasure.ml },
      { slug: 'coffee_liqueur', quantity: 40, unit: UnitOfMeasure.ml },
      { slug: 'sugar', quantity: 15, unit: UnitOfMeasure.g },
    ],
  });

  // 18. Avocado Toast con Uovo (Snack, Easy, 15 min)
  const avocadoToast = await seedRecipe({
    authorId: userGiulia.id,
    course: Course.snack,
    difficulty: RecipeDifficulty.easy,
    prepTime: 5,
    cookTime: 10,
    servings: 2,
    coverImageUrl:
      'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800',
    tagSlugs: ['vegetarian', 'quick_easy', 'nut_free', 'summer'],
    translations: {
      it: {
        title: 'Avocado Toast con Uovo in Camicia',
        description:
          'Fette di pane tostato spalmate con polpa d’avocado al lime e coronate da un uovo in camicia dal tuorlo morbido e fondente.',
        tips: 'Crea un vortice nell’acqua quasi bollente con un goccio d’aceto per racchiudere l’albume attorno al tuorlo.',
        preservation: 'Consumare caldo subito.',
      },
      en: {
        title: 'Poached Egg Avocado Sourdough Toast',
        description:
          'Toasted artisan sourdough bread spread with seasoned smashed avocado and crowned with a warm runny poached egg.',
        tips: 'Swirl simmering water into a vortex before sliding in the egg to keep the whites compact.',
        preservation: 'Serve immediately.',
      },
      fr: {
        title: 'Tartine d’Avocat et Œuf Poché Coulant',
        description:
          'Tranches de pain au levain grillées, purée d’avocat citronnée et œuf poché au jaune délicatement coulant.',
        tips: 'Créez un tourbillon dans l’eau frémissante vinaigrée pour bien envelopper le jaune de blanc d’œuf.',
        preservation: 'À déguster aussitôt préparé.',
      },
    },
    steps: [
      {
        duration: 5,
        translations: {
          it: {
            title: 'Tostare il pane e schiacciare l’avocado',
            description:
              'Tosta le fette di pane. Schiaccia l’avocado con succo di limone, un filo d’olio, sale e pepe.',
          },
          en: {
            title: 'Toast bread and smash avocado',
            description:
              'Toast bread slices until golden. Mash avocado with lemon juice, olive oil, salt, and black pepper.',
          },
          fr: {
            title: 'Griller et écraser l’avocat',
            description:
              'Grillez les tranches de pain. Écrasez l’avocat avec le jus de citron, l’huile d’olive, sel et poivre.',
          },
        },
      },
      {
        duration: 10,
        translations: {
          it: {
            title: 'Pociare l’uovo e impiattare',
            description:
              'Cuoci le uova in acqua sobbollente per 3 minuti, spalma l’avocado sul pane e adagia l’uovo sopra tagliandolo delicatamente.',
          },
          en: {
            title: 'Poach egg and assemble',
            description:
              'Poach eggs in gentle simmering water for 3 minutes. Spread avocado over toast and top with warm poached egg.',
          },
          fr: {
            title: 'Pocher l’œuf et dresser',
            description:
              'Pochez les œufs pendant 3 minutes dans l’eau frémissante. Tartinez l’avocat sur le pain et déposez l’œuf poché.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'bread', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'avocado', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'eggs', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'lemon', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 15, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
      { slug: 'black_pepper', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 19. Hummus di Ceci (Snack, Easy, 15 min)
  const hummus = await seedRecipe({
    authorId: userCarlos.id,
    course: Course.snack,
    difficulty: RecipeDifficulty.easy,
    prepTime: 15,
    cookTime: 0,
    servings: 4,
    coverImageUrl:
      'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=800',
    tagSlugs: [
      'vegan',
      'vegetarian',
      'gluten_free',
      'dairy_free',
      'nut_free',
      'budget_friendly',
    ],
    translations: {
      it: {
        title: 'Hummus Vellutato di Ceci con Tahina e Limone',
        description:
          'La celebre crema mediorientale di ceci frullati con salsa tahina, succo fresco di limone, spicchio d’aglio e olio extravergine.',
        tips: 'Aggiungi un paio di cubetti di ghiaccio mentre frulli per montare la crema e renderla incredibilmente soffice e spumosa.',
        preservation:
          'Conservare in frigo in contenitore chiuso fino a 4 giorni.',
      },
      en: {
        title: 'Creamy Lemon & Garlic Chickpea Hummus',
        description:
          'Ultra-smooth Mediterranean dip made from blended chickpeas, rich sesame tahini, fresh lemon juice, garlic, and olive oil.',
        tips: 'Toss a couple of ice cubes into the food processor to aerate and lighten the hummus texture.',
        preservation:
          'Keep refrigerated in an airtight container for up to 4 days.',
      },
      fr: {
        title: 'Houmous Onctueux au Citron et Tahini',
        description:
          'Purée veloutée de pois chiches émulsionnée à la pâte de sésame, jus de citron jaune, ail et généreux filet d’huile d’olive.',
        tips: 'Ajoutez deux glaçons lors du mixage pour obtenir une texture ultra légère et aérienne.',
        preservation:
          'Se conserve au réfrigérateur dans un récipient étanche jusqu’à 4 jours.',
      },
    },
    steps: [
      {
        duration: 15,
        translations: {
          it: {
            title: 'Frullare e montare l’hummus',
            description:
              'Unisci nel mixer ceci, salsa tahina, succo di limone, aglio e sale. Frulla versando olio a filo fino a ottenere una crema liscia.',
          },
          en: {
            title: 'Blend to a velvety puree',
            description:
              'Combine chickpeas, tahini, lemon juice, garlic, and sea salt in food processor. Drizzle in olive oil while blending until silky.',
          },
          fr: {
            title: 'Mixer finement',
            description:
              'Placez les pois chiches, le tahini, le jus de citron, l’ail et le sel dans le robot. Mixez en versant l’huile d’olive.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'chickpeas', quantity: 400, unit: UnitOfMeasure.g },
      { slug: 'tahini', quantity: 60, unit: UnitOfMeasure.g },
      { slug: 'lemon', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'garlic', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'olive_oil', quantity: 40, unit: UnitOfMeasure.ml },
      { slug: 'salt', quantity: 1, unit: UnitOfMeasure.pinch },
    ],
  });

  // 20. Croissant Francesi Sfogliati (Dessert, Hard, 720 min)
  const croissants = await seedRecipe({
    ownerType: OwnerType.platform,
    course: Course.dessert,
    difficulty: RecipeDifficulty.hard,
    prepTime: 680,
    cookTime: 40,
    servings: 8,
    coverImageUrl:
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800',
    videoUrl: 'https://www.youtube.com/watch?v=dummy_croissant',
    tagSlugs: ['traditional', 'vegetarian', 'comfort_food'],
    translations: {
      it: {
        title: 'Croissant Francesi Sfogliati al Burro (Ricetta Ufficiale)',
        description:
          'La maestria della pasticceria parigina: sfogliatura impeccabile con burro di qualità per cornetti leggeri, friabili e dorati.',
        tips: 'Mantieni il burro e l’impasto alla medesima temperatura durante le pieghe per non rompere i fogli di sfoglia.',
        preservation:
          'Gustare caldi; riscaldare pochi istanti in forno prima di servire.',
      },
      en: {
        title: 'Artisanal French Butter Croissants (Official Recipe)',
        description:
          'Classic bakery-style flaky French laminated pastry made with cultured butter, baked to deep golden perfection.',
        tips: 'Keep dough and butter block at the exact same pliable temperature during folding turns.',
        preservation:
          'Best enjoyed fresh and warm; crisp up in the oven for a few minutes if stored.',
      },
      fr: {
        title: 'Croissants Pur Beurre Feuilletés (Recette Officielle)',
        description:
          'Le joyau de la viennoiserie française : un feuilletage d’orfèvre pur beurre pour des croissants dorés, croustillants et aériens.',
        tips: 'Veillez à ce que le beurre de tourage et le pâton soient à la même consistance.',
        preservation: 'À savourer tièdes le matin même.',
      },
    },
    steps: [
      {
        duration: 360,
        translations: {
          it: {
            title: 'Impasto e incasso del burro',
            description:
              'Prepara la détrempe con farina, latte, lievito e zucchero. Incassa il panetto di burro piatto ed esegui i giri di sfoglia con riposi in frigo.',
          },
          en: {
            title: 'Lamination turns',
            description:
              'Mix dough, enclose chilled butter block, and perform three envelope turns with chilled resting intervals.',
          },
          fr: {
            title: 'Tourage du pâton',
            description:
              'Réalisez la détrempe, enfermez le carré de beurre et donnez les tours simples et doubles avec repos au froid.',
          },
        },
      },
      {
        duration: 360,
        translations: {
          it: {
            title: 'Formatura e lievitazione',
            description:
              'Stendi a 4mm, ricava triangoli isosceli, arrotola i croissant e lascia lievitare 2 ore prima di cuocere a 200°C.',
          },
          en: {
            title: 'Shape and proof',
            description:
              'Roll dough thin, cut into triangles, shape into crescents, proof until doubled, and bake at 200°C until deeply golden.',
          },
          fr: {
            title: 'Façonnage, pousse et cuisson',
            description:
              'Découpez les triangles, roulez les croissants, laissez pousser 2h et enfournez à 200°C jusqu’à dorure complète.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'flour', quantity: 500, unit: UnitOfMeasure.g },
      { slug: 'butter', quantity: 280, unit: UnitOfMeasure.g },
      { slug: 'milk', quantity: 150, unit: UnitOfMeasure.ml },
      { slug: 'sugar', quantity: 60, unit: UnitOfMeasure.g },
      { slug: 'yeast', quantity: 10, unit: UnitOfMeasure.g },
      { slug: 'salt', quantity: 10, unit: UnitOfMeasure.g },
      {
        slug: 'eggs',
        quantity: 1,
        unit: UnitOfMeasure.piece,
        notes: {
          it: 'per la doratura',
          en: 'for egg wash',
          fr: 'pour la dorure',
        },
      },
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. SOCIAL GRAPH (Amicizie e Richieste)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('🤝 Creazione grafo di amicizie bidirezionali e richieste...');
  await prisma.friendship.createMany({
    data: [
      // Amicizie confermate bidirezionali (Mario & Giulia, Marco & Sophie, Elena & Carlos)
      {
        requester_id: userMario.id,
        addressee_id: userGiulia.id,
        status: FriendshipStatus.accepted,
      },
      {
        requester_id: userMarco.id,
        addressee_id: userSophie.id,
        status: FriendshipStatus.accepted,
      },
      {
        requester_id: userElena.id,
        addressee_id: userCarlos.id,
        status: FriendshipStatus.accepted,
      },
      {
        requester_id: adminMarghe.id,
        addressee_id: userMario.id,
        status: FriendshipStatus.accepted,
      },
      {
        requester_id: modSarah.id,
        addressee_id: userGiulia.id,
        status: FriendshipStatus.accepted,
      },

      // Richieste pendenti (per test UI / API)
      {
        requester_id: userKenji.id,
        addressee_id: userMario.id,
        status: FriendshipStatus.pending,
      },
      {
        requester_id: userCarlos.id,
        addressee_id: userMarco.id,
        status: FriendshipStatus.pending,
      },
      {
        requester_id: userGiulia.id,
        addressee_id: userSophie.id,
        status: FriendshipStatus.pending,
      },
    ],
    skipDuplicates: true,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 6. INTERAZIONI (Like, Commenti ad albero, Moderazione e Notifiche)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('💬 Creazione Commenti a più livelli, Like e Notifiche...');

  // Commenti su Carbonara
  const commCarbonara1 = await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: userGiulia.id,
      content:
        'Ricetta fantastica! Ma il guanciale lo sfumi con un goccio di vino bianco?',
    },
  });

  // Commento modificato
  await prisma.comment.create({
    data: {
      recipe_id: carbonara.id,
      user_id: userMarco.id,
      content:
        'Tecnica perfetta Mario. La vera tradizione romana è rispettata al 100%.',
      is_edited: true,
    },
  });

  // Commento su Risotto ai Funghi
  const commRisotto1 = await prisma.comment.create({
    data: {
      recipe_id: risotto.id,
      user_id: userKenji.id,
      content:
        'Chef Marco, quale brodo consigli per non coprire il sapore dei porcini?',
    },
  });

  await prisma.comment.create({
    data: {
      recipe_id: risotto.id,
      user_id: userMarco.id,
      parent_id: commRisotto1.id,
      content:
        'Consiglio un brodo vegetale leggero fatto solo con sedano, carota e cipolla, oppure un brodo ottenuto filtrando l’acqua dei funghi secchi!',
    },
  });

  // Commento moderato / disattivato per test admin
  await prisma.comment.create({
    data: {
      recipe_id: pizzaPlatform.id,
      user_id: userBanned.id,
      content:
        'OFFERTA SPECIALE: Compra subito follower e ricette su spam-site.com!',
      is_active: false,
    },
  });

  // Commento su Guacamole
  await prisma.comment.create({
    data: {
      recipe_id: guacamole.id,
      user_id: userElena.id,
      content: 'Fresco e saporito, ottimo snack vegano dopo l’allenamento!',
    },
  });

  // Commento su Tiramisù
  await prisma.comment.create({
    data: {
      recipe_id: tiramisu.id,
      user_id: userSophie.id,
      content:
        'La crema al mascarpone è venuta soffice come una nuvola, complimenti Giulia!',
    },
  });

  // LIKES DISTRIBUITI
  await prisma.like.createMany({
    data: [
      // Pizza Margherita (7 likes)
      { user_id: adminMarghe.id, recipe_id: pizzaPlatform.id },
      { user_id: userMario.id, recipe_id: pizzaPlatform.id },
      { user_id: userGiulia.id, recipe_id: pizzaPlatform.id },
      { user_id: userMarco.id, recipe_id: pizzaPlatform.id },
      { user_id: userSophie.id, recipe_id: pizzaPlatform.id },
      { user_id: userKenji.id, recipe_id: pizzaPlatform.id },
      { user_id: userCarlos.id, recipe_id: pizzaPlatform.id },

      // Carbonara (5 likes)
      { user_id: adminMarghe.id, recipe_id: carbonara.id },
      { user_id: userGiulia.id, recipe_id: carbonara.id },
      { user_id: userMarco.id, recipe_id: carbonara.id },
      { user_id: userKenji.id, recipe_id: carbonara.id },
      { user_id: modSarah.id, recipe_id: carbonara.id },

      // Tiramisù (5 likes)
      { user_id: adminMarghe.id, recipe_id: tiramisu.id },
      { user_id: userMario.id, recipe_id: tiramisu.id },
      { user_id: userSophie.id, recipe_id: tiramisu.id },
      { user_id: userElena.id, recipe_id: tiramisu.id },
      { user_id: userCarlos.id, recipe_id: tiramisu.id },

      // Fondant al Cioccolato (4 likes)
      { user_id: userMario.id, recipe_id: fondant.id },
      { user_id: userGiulia.id, recipe_id: fondant.id },
      { user_id: userElena.id, recipe_id: fondant.id },
      { user_id: adminMarghe.id, recipe_id: fondant.id },

      // Salmone (3 likes)
      { user_id: userGiulia.id, recipe_id: salmonDish.id },
      { user_id: userMarco.id, recipe_id: salmonDish.id },
      { user_id: modSarah.id, recipe_id: salmonDish.id },

      // Guacamole (3 likes)
      { user_id: userCarlos.id, recipe_id: guacamole.id },
      { user_id: userElena.id, recipe_id: guacamole.id },
      { user_id: userMario.id, recipe_id: guacamole.id },

      // Risotto (2 likes)
      { user_id: adminMarghe.id, recipe_id: risotto.id },
      { user_id: userGiulia.id, recipe_id: risotto.id },

      // Bruschetta (2 likes)
      { user_id: userGiulia.id, recipe_id: bruschetta.id },
      { user_id: userElena.id, recipe_id: bruschetta.id },

      // Espresso Martini (2 likes)
      { user_id: userMarco.id, recipe_id: espressoMartini.id },
      { user_id: modSarah.id, recipe_id: espressoMartini.id },

      // Chia Pudding (1 like)
      { user_id: userElena.id, recipe_id: chiaPudding.id },

      // NOTA: zuppa di lenticchie ha 0 likes di proposito per testare conteggio zero!
    ],
    skipDuplicates: true,
  });

  // NOTIFICHE (Like e Commenti, letti e non letti)
  await prisma.notification.createMany({
    data: [
      // Per Mario (autore Carbonara)
      {
        user_id: userMario.id,
        actor_id: userGiulia.id,
        subject: NotificationSubject.recipe,
        action: NotificationAction.comment,
        target_id: carbonara.id,
        is_read: true,
      },
      {
        user_id: userMario.id,
        actor_id: userGiulia.id,
        subject: NotificationSubject.recipe,
        action: NotificationAction.like,
        target_id: carbonara.id,
      },
      {
        user_id: userGiulia.id,
        actor_id: adminMarghe.id,
        subject: NotificationSubject.recipe,
        action: NotificationAction.like,
        target_id: tiramisu.id,
      },
    ],
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. MEAL PLANS DIVERSIFICATI
  // ─────────────────────────────────────────────────────────────────────────
  console.log('📅 Creazione Meal Plans multi-giorno...');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  // Meal Plan per Margherita (Admin)
  await prisma.mealPlan.create({
    data: {
      user_id: adminMarghe.id,
      start_date: today,
      end_date: tomorrow,
      meal_plan_recipes: {
        create: [
          {
            recipe_id: bruschetta.id,
            planned_date: today,
            meal_type: MealType.breakfast,
          },
          {
            recipe_id: carbonara.id,
            planned_date: today,
            meal_type: MealType.lunch,
          },
          {
            recipe_id: smoothie.id,
            planned_date: today,
            meal_type: MealType.snack,
          },
          {
            recipe_id: salmonDish.id,
            planned_date: today,
            meal_type: MealType.dinner,
          },
          {
            recipe_id: chiaPudding.id,
            planned_date: tomorrow,
            meal_type: MealType.breakfast,
          },
          {
            recipe_id: risotto.id,
            planned_date: tomorrow,
            meal_type: MealType.lunch,
          },
          {
            recipe_id: pizzaPlatform.id,
            planned_date: tomorrow,
            meal_type: MealType.dinner,
          },
        ],
      },
    },
  });

  // Meal Plan per Mario
  await prisma.mealPlan.create({
    data: {
      user_id: userMario.id,
      start_date: today,
      end_date: dayAfter,
      meal_plan_recipes: {
        create: [
          {
            recipe_id: avocadoToast.id,
            planned_date: today,
            meal_type: MealType.breakfast,
          },
          {
            recipe_id: carbonara.id,
            planned_date: today,
            meal_type: MealType.lunch,
          },
          {
            recipe_id: smoothie.id,
            planned_date: today,
            meal_type: MealType.snack,
          },
          {
            recipe_id: salmonDish.id,
            planned_date: today,
            meal_type: MealType.dinner,
          },
          {
            recipe_id: bruschetta.id,
            planned_date: tomorrow,
            meal_type: MealType.breakfast,
          },
          {
            recipe_id: risotto.id,
            planned_date: tomorrow,
            meal_type: MealType.lunch,
          },
          {
            recipe_id: guacamole.id,
            planned_date: tomorrow,
            meal_type: MealType.snack,
          },
          {
            recipe_id: boeufBourguignon.id,
            planned_date: tomorrow,
            meal_type: MealType.dinner,
          },
          {
            recipe_id: chiaPudding.id,
            planned_date: dayAfter,
            meal_type: MealType.breakfast,
          },
          {
            recipe_id: lentilsSoup.id,
            planned_date: dayAfter,
            meal_type: MealType.lunch,
          },
          {
            recipe_id: fondant.id,
            planned_date: dayAfter,
            meal_type: MealType.snack,
          },
          {
            recipe_id: pizzaPlatform.id,
            planned_date: dayAfter,
            meal_type: MealType.dinner,
          },
        ],
      },
    },
  });

  // Meal Plan per Giulia
  await prisma.mealPlan.create({
    data: {
      user_id: userGiulia.id,
      start_date: today,
      end_date: tomorrow,
      meal_plan_recipes: {
        create: [
          {
            recipe_id: carbonara.id,
            planned_date: today,
            meal_type: MealType.lunch,
          },
          {
            recipe_id: caprese.id,
            planned_date: today,
            meal_type: MealType.dinner,
          },
          {
            recipe_id: croissants.id,
            planned_date: tomorrow,
            meal_type: MealType.breakfast,
          },
          {
            recipe_id: boeufBourguignon.id,
            planned_date: tomorrow,
            meal_type: MealType.dinner,
          },
        ],
      },
    },
  });

  console.log('✅ Seed completato con successo!');
  console.log(`   Utenti di prova (password: Password123): ${adminMarghe.username} (admin), ${userMario.username}, ${userGiulia.username}`);
  console.log(`   Per test admin: ${userDisabled.username} (disattivato), ${userBanned.username} (bannato)`);
}

main()
  .catch((e) => {
    console.error('❌ Errore durante il seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
