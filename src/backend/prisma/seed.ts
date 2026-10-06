import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Role, OwnerType, RecipeDifficulty, MediaType, NotificationType, MealType, IngredientCategory, UnitOfMeasure, TranslationStatus, Course } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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

  // 2. INGREDIENTI & TAG
  console.log('🍅 Creazione Ingredienti e Tag...');

  const baselineIngredients = [
    // Produce
    { slug: 'tomato', category: IngredientCategory.produce, name_it: 'Pomodoro', name_en: 'Tomato', name_fr: 'Tomate' },
    { slug: 'basil', category: IngredientCategory.produce, name_it: 'Basilico', name_en: 'Basil', name_fr: 'Basilic' },
    { slug: 'garlic', category: IngredientCategory.produce, name_it: 'Aglio', name_en: 'Garlic', name_fr: 'Ail' },
    { slug: 'onion', category: IngredientCategory.produce, name_it: 'Cipolla', name_en: 'Onion', name_fr: 'Oignon' },
    { slug: 'lemon', category: IngredientCategory.produce, name_it: 'Limone', name_en: 'Lemon', name_fr: 'Citron' },
    // Dairy & Eggs
    { slug: 'eggs', category: IngredientCategory.dairy_eggs, name_it: 'Uova', name_en: 'Eggs', name_fr: 'Œufs' },
    { slug: 'butter', category: IngredientCategory.dairy_eggs, name_it: 'Burro', name_en: 'Butter', name_fr: 'Beurre' },
    { slug: 'milk', category: IngredientCategory.dairy_eggs, name_it: 'Latte', name_en: 'Milk', name_fr: 'Lait' },
    { slug: 'parmesan', category: IngredientCategory.dairy_eggs, name_it: 'Parmigiano Reggiano', name_en: 'Parmesan', name_fr: 'Parmesan' },
    { slug: 'pecorino', category: IngredientCategory.dairy_eggs, name_it: 'Pecorino Romano', name_en: 'Pecorino Romano', name_fr: 'Pecorino Romano' },
    { slug: 'mascarpone', category: IngredientCategory.dairy_eggs, name_it: 'Mascarpone', name_en: 'Mascarpone', name_fr: 'Mascarpone' },
    // Meat & Poultry
    { slug: 'guanciale', category: IngredientCategory.meat_poultry, name_it: 'Guanciale', name_en: 'Cured Pork Cheek', name_fr: 'Guanciale' },
    { slug: 'chicken_breast', category: IngredientCategory.meat_poultry, name_it: 'Petto di Pollo', name_en: 'Chicken Breast', name_fr: 'Blanc de Poulet' },
    { slug: 'beef_mince', category: IngredientCategory.meat_poultry, name_it: 'Macinato di Manzo', name_en: 'Minced Beef', name_fr: 'Bœuf Haché' },
    // Seafood
    { slug: 'salmon', category: IngredientCategory.seafood, name_it: 'Salmone', name_en: 'Salmon', name_fr: 'Saumon' },
    { slug: 'prawns', category: IngredientCategory.seafood, name_it: 'Gamberi', name_en: 'Prawns', name_fr: 'Crevettes' },
    // Bakery & Grains
    { slug: 'pasta', category: IngredientCategory.bakery_grains, name_it: 'Pasta', name_en: 'Pasta', name_fr: 'Pâtes' },
    { slug: 'flour', category: IngredientCategory.bakery_grains, name_it: 'Farina', name_en: 'Flour', name_fr: 'Farine' },
    { slug: 'rice', category: IngredientCategory.bakery_grains, name_it: 'Riso Carnaroli', name_en: 'Carnaroli Rice', name_fr: 'Riz Carnaroli' },
    { slug: 'ladyfingers', category: IngredientCategory.bakery_grains, name_it: 'Savoiardi', name_en: 'Ladyfingers', name_fr: 'Biscuits Cuillère' },
    // Pantry & Spices
    { slug: 'olive_oil', category: IngredientCategory.pantry_spices, name_it: 'Olio Extravergine', name_en: 'Extra Virgin Olive Oil', name_fr: 'Huile d\'Olive Extra Vierge' },
    { slug: 'salt', category: IngredientCategory.pantry_spices, name_it: 'Sale', name_en: 'Salt', name_fr: 'Sel' },
    { slug: 'black_pepper', category: IngredientCategory.pantry_spices, name_it: 'Pepe', name_en: 'Black Pepper', name_fr: 'Poivre Noir' },
    { slug: 'sugar', category: IngredientCategory.pantry_spices, name_it: 'Zucchero', name_en: 'Sugar', name_fr: 'Sucre' },
    { slug: 'cocoa', category: IngredientCategory.pantry_spices, name_it: 'Cacao', name_en: 'Cocoa Powder', name_fr: 'Cacao en Poudre' },
    // Legumes & Nuts
    { slug: 'lentils', category: IngredientCategory.legumes_nuts, name_it: 'Lenticchie', name_en: 'Lentils', name_fr: 'Lentilles' },
    { slug: 'walnuts', category: IngredientCategory.legumes_nuts, name_it: 'Noci', name_en: 'Walnuts', name_fr: 'Noix' },
    // Beverages & Liquids
    { slug: 'coffee', category: IngredientCategory.beverages_liquids, name_it: 'Caffè', name_en: 'Espresso Coffee', name_fr: 'Café Espresso' },
    { slug: 'white_wine', category: IngredientCategory.beverages_liquids, name_it: 'Vino Bianco', name_en: 'White Wine', name_fr: 'Vin Blanc' },
    // Other
    { slug: 'vanilla', category: IngredientCategory.other, name_it: 'Estratto di Vaniglia', name_en: 'Vanilla Extract', name_fr: 'Extrait de Vanille' },
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
    ingredients[item.name_it] = record;
  }

  console.log('🏷️ Creazione Tag...');
  const tags: Record<string, any> = {};
  const baselineTags = [
    { slug: 'vegetarian', name_it: 'Vegetariano', name_en: 'Vegetarian', name_fr: 'Végétarien' },
    { slug: 'vegan', name_it: 'Vegano', name_en: 'Vegan', name_fr: 'Végétalien' },
    { slug: 'gluten_free', name_it: 'Senza Glutine', name_en: 'Gluten-Free', name_fr: 'Sans Gluten' },
    { slug: 'dairy_free', name_it: 'Senza Lattosio', name_en: 'Dairy-Free', name_fr: 'Sans Produits Laitiers' },
    { slug: 'nut_free', name_it: 'Senza Frutta a Guscio', name_en: 'Nut-Free', name_fr: 'Sans Fruits à Coque' },
    { slug: 'low_carb', name_it: 'A Basso Contenuto di Carboidrati', name_en: 'Low-Carb', name_fr: 'Faible en Glucides' },
    { slug: 'quick_easy', name_it: 'Veloce e Facile', name_en: 'Quick & Easy', name_fr: 'Rapide et Facile' },
    { slug: 'traditional', name_it: 'Tradizionale', name_en: 'Traditional', name_fr: 'Traditionnel' },
    { slug: 'comfort_food', name_it: 'Comfort Food', name_en: 'Comfort Food', name_fr: 'Plat Réconfortant' },
    { slug: 'budget_friendly', name_it: 'Economico', name_en: 'Budget-Friendly', name_fr: 'Économique' },
    { slug: 'summer', name_it: 'Estivo', name_en: 'Summer', name_fr: 'Estival' },
    { slug: 'winter', name_it: 'Invernale', name_en: 'Winter', name_fr: 'Hivernal' },
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

  // 3. RICETTE
  console.log('🍳 Creazione Ricette...');
  
  const carbonara = await prisma.recipe.create({
    data: {
      user_id: userMario.id,
      owner_type: OwnerType.user,
      course: Course.first_course,
      prep_time: 15,
      cook_time: 10,
      total_time: 25,
      servings: 4,
      difficulty: RecipeDifficulty.medium,
      source_lang: 'it',
      translation_status: TranslationStatus.completed,
      translations: {
        create: [
          {
            locale: 'it',
            title: 'Pasta alla Carbonara',
            description: 'La vera carbonara romana, cremosa e saporita, senza panna!',
            tips: 'Non aggiungere mai la panna!',
            preservation: 'Consumare calda al momento.',
          },
          {
            locale: 'en',
            title: 'Spaghetti Carbonara',
            description: 'Authentic Roman carbonara, creamy and savory, no cream!',
            tips: 'Never add cream!',
            preservation: 'Serve immediately while hot.',
          },
          {
            locale: 'fr',
            title: 'Pâtes Carbonara',
            description: 'La vraie carbonara romaine, crémeuse et savoureuse, sans crème !',
            tips: 'Ne jamais ajouter de crème !',
            preservation: 'Déguster bien chaud immédiatement.',
          },
        ],
      },
      steps: {
        create: [
          {
            step_number: 1,
            duration: 5,
            translations: {
              create: [
                { locale: 'it', title: 'Rosolare il guanciale', description: 'Rosola il guanciale in padella finché non è croccante.' },
                { locale: 'en', title: 'Brown the guanciale', description: 'Brown guanciale in a pan until crispy.' },
                { locale: 'fr', title: 'Dorer le guanciale', description: 'Faites dorer le guanciale dans une poêle jusqu\'à ce qu\'il soit croustillant.' },
              ],
            },
          },
          {
            step_number: 2,
            duration: 10,
            translations: {
              create: [
                { locale: 'it', title: 'Cuocere la pasta', description: 'Cuoci la pasta in abbondante acqua bollente poco salata.' },
                { locale: 'en', title: 'Cook pasta', description: 'Cook pasta in salted boiling water until al dente.' },
                { locale: 'fr', title: 'Cuire les pâtes', description: 'Faites cuire les pâtes dans une eau bouillante peu salée.' },
              ],
            },
          },
          {
            step_number: 3,
            duration: 5,
            translations: {
              create: [
                { locale: 'it', title: 'Mantecare', description: 'Mescola uova e pecorino, unisci tutto a fuoco spento mantecando con acqua di cottura.' },
                { locale: 'en', title: 'Combine', description: 'Whisk eggs with pecorino, mix off heat with cooking water.' },
                { locale: 'fr', title: 'Mélanger', description: 'Mélangez les œufs et le pecorino, incorporez hors du feu avec de l\'eau de cuisson.' },
              ],
            },
          },
        ],
      },
      recipe_ingredients: {
        create: [
          { ingredient_id: ingredients['Pasta'].id, quantity: 320, unit: UnitOfMeasure.g, notes: { it: 'al dente', en: 'al dente', fr: 'al dente' } },
          { ingredient_id: ingredients['Uova'].id, quantity: 4, unit: UnitOfMeasure.piece, notes: { it: 'tuorli freschi', en: 'fresh egg yolks', fr: 'jaunes d\'œufs frais' } },
          { ingredient_id: ingredients['Guanciale'].id, quantity: 150, unit: UnitOfMeasure.g, notes: { it: 'tagliato a listarelle', en: 'cut into strips', fr: 'coupé en lanières' } },
          { ingredient_id: ingredients['Pecorino Romano'].id, quantity: 80, unit: UnitOfMeasure.g, notes: { it: 'grattugiato fresco', en: 'freshly grated', fr: 'fraîchement râpé' } },
          { ingredient_id: ingredients['Pepe'].id, quantity: 1, unit: UnitOfMeasure.pinch, notes: { it: 'macinato fresco', en: 'freshly cracked', fr: 'fraîchement moulu' } },
        ],
      },
      recipe_tags: {
        create: [
          { tag_id: tags['quick_easy'].id },
        ],
      },
      recipe_media: {
        create: [
          { media_type: MediaType.image, url: 'https://images.unsplash.com/photo-1612874742237-6526221288c8?w=800', order: 0 },
        ],
      },
    },
  });

  const tiramisu = await prisma.recipe.create({
    data: {
      user_id: userGiulia.id,
      owner_type: OwnerType.user,
      course: Course.dessert,
      prep_time: 25,
      cook_time: 15,
      total_time: 40,
      servings: 6,
      difficulty: RecipeDifficulty.easy,
      source_lang: 'it',
      translation_status: TranslationStatus.completed,
      translations: {
        create: [
          {
            locale: 'it',
            title: 'Tiramisù Classico',
            description: 'Il dolce italiano per eccellenza, con caffè espresso e crema al mascarpone.',
            tips: 'Usa uova a temperatura ambiente.',
            preservation: 'Conservare in frigo fino a 2 giorni.',
          },
          {
            locale: 'en',
            title: 'Classic Tiramisu',
            description: 'The quintessential Italian dessert, with espresso and mascarpone cream.',
            tips: 'Use room temperature eggs.',
            preservation: 'Refrigerate for up to 2 days.',
          },
          {
            locale: 'fr',
            title: 'Tiramisu Classique',
            description: 'Le dessert italien par excellence, avec café expresso et crème au mascarpone.',
            tips: 'Utilisez des œufs à température ambiante.',
            preservation: 'Conserver au réfrigérateur jusqu\'à 2 jours.',
          },
        ],
      },
      steps: {
        create: [
          {
            step_number: 1,
            duration: 10,
            translations: {
              create: [
                { locale: 'it', title: 'Preparare la crema', description: 'Monta i tuorli con lo zucchero, poi aggiungi il mascarpone e gli albumi montati.' },
                { locale: 'en', title: 'Make cream', description: 'Beat egg yolks with sugar, add mascarpone and fold in whipped whites.' },
                { locale: 'fr', title: 'Préparer la crème', description: 'Battez les jaunes d\'œufs avec le sucre, ajoutez le mascarpone et incorporez les blancs.' },
              ],
            },
          },
          {
            step_number: 2,
            duration: 15,
            translations: {
              create: [
                { locale: 'it', title: 'Comporre gli strati', description: 'Inzuppa i savoiardi nel caffè e crea strati alternati con la crema. Spolvera di cacao.' },
                { locale: 'en', title: 'Assemble layers', description: 'Dip ladyfingers into espresso, alternate layers with cream, dust with cocoa.' },
                { locale: 'fr', title: 'Assembler', description: 'Trempez les boudoirs dans le café, alternez les couches de crème et saupoudrez de cacao.' },
              ],
            },
          },
        ],
      },
      recipe_ingredients: {
        create: [
          { ingredient_id: ingredients['Savoiardi'].id, quantity: 300, unit: UnitOfMeasure.g },
          { ingredient_id: ingredients['Mascarpone'].id, quantity: 500, unit: UnitOfMeasure.g },
          { ingredient_id: ingredients['Uova'].id, quantity: 4, unit: UnitOfMeasure.piece },
          { ingredient_id: ingredients['Caffè'].id, quantity: 300, unit: UnitOfMeasure.ml, notes: { it: 'amaro e freddo', en: 'unsweetened and cold', fr: 'non sucré et froid' } },
          { ingredient_id: ingredients['Cacao'].id, quantity: 30, unit: UnitOfMeasure.g },
          { ingredient_id: ingredients['Zucchero'].id, quantity: 100, unit: UnitOfMeasure.g },
        ],
      },
      recipe_tags: {
        create: [
          { tag_id: tags['vegetarian'].id },
        ],
      },
      recipe_media: {
        create: [
          { media_type: MediaType.image, url: 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=800', order: 0 },
          { media_type: MediaType.video, url: 'https://www.youtube.com/watch?v=dummy', order: 1 },
        ],
      },
    },
  });

  const pizzaPlatform = await prisma.recipe.create({
    data: {
      owner_type: OwnerType.platform,
      course: Course.main_course,
      prep_time: 1440, // 24 ore
      cook_time: 15,
      total_time: 1455,
      servings: 4,
      difficulty: RecipeDifficulty.hard,
      source_lang: 'it',
      translation_status: TranslationStatus.completed,
      translations: {
        create: [
          {
            locale: 'it',
            title: 'Pizza Margherita (Ricetta Ufficiale)',
            description: 'La ricetta perfetta per l\'impasto della pizza a lunga lievitazione, testata dagli chef della nostra app.',
            tips: 'Usa una pietra refrattaria per cuocere.',
            preservation: 'Consumare appena sfornata.',
          },
          {
            locale: 'en',
            title: 'Margherita Pizza (Official Recipe)',
            description: 'The ultimate recipe for slow-fermented pizza dough, perfected by our chefs.',
            tips: 'Use a pizza stone for baking.',
            preservation: 'Best enjoyed fresh from the oven.',
          },
          {
            locale: 'fr',
            title: 'Pizza Margherita (Recette Officielle)',
            description: 'La recette parfaite pour une pâte à pizza à fermentation lente, validée par nos chefs.',
            tips: 'Utilisez une pierre réfractaire pour la cuisson.',
            preservation: 'À déguster dès la sortie du four.',
          },
        ],
      },
      steps: {
        create: [
          {
            step_number: 1,
            duration: 1440,
            translations: {
              create: [
                { locale: 'it', title: 'Impasto e lievitazione', description: 'Impasta farina, acqua e lievito. Fai lievitare 24 ore in frigorifero.' },
                { locale: 'en', title: 'Dough & Fermentation', description: 'Knead flour, water, and yeast. Proof in the fridge for 24 hours.' },
                { locale: 'fr', title: 'Pâte et fermentation', description: 'Pétrissez farine, eau et levure. Laissez fermenter au frais pendant 24h.' },
              ],
            },
          },
          {
            step_number: 2,
            duration: 15,
            translations: {
              create: [
                { locale: 'it', title: 'Stesura e cottura', description: 'Stendi la pasta, condisci con pomodoro e cuoci a 250°C per 12 minuti. Aggiungi basilico.' },
                { locale: 'en', title: 'Shape and bake', description: 'Stretch dough, top with tomato, bake at 250°C for 12 minutes. Finish with basil.' },
                { locale: 'fr', title: 'Étaler et cuire', description: 'Étalez la pâte, garnissez de sauce tomate et enfournez à 250°C pour 12 minutes. Ajoutez le basilic.' },
              ],
            },
          },
        ],
      },
      recipe_ingredients: {
        create: [
          { ingredient_id: ingredients['Farina'].id, quantity: 500, unit: UnitOfMeasure.g },
          { ingredient_id: ingredients['Pomodoro'].id, quantity: 200, unit: UnitOfMeasure.g },
          { ingredient_id: ingredients['Basilico'].id, quantity: 5, unit: UnitOfMeasure.piece, notes: { it: 'foglie fresche', en: 'fresh leaves', fr: 'feuilles fraîches' } },
          { ingredient_id: ingredients['Olio Extravergine'].id, quantity: 20, unit: UnitOfMeasure.ml },
          { ingredient_id: ingredients['Sale'].id, quantity: 12, unit: UnitOfMeasure.g },
        ],
      },
      recipe_tags: {
        create: [
          { tag_id: tags['vegetarian'].id },
        ],
      },
      recipe_media: {
        create: [
          { media_type: MediaType.image, url: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=800', order: 0 },
        ],
      },
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