import {
  Course,
  OwnerType,
  RecipeDifficulty,
  RecipePrivacy,
  TranslationSource,
  TranslationStatus,
  UnitOfMeasure,
} from '@prisma/client';
import type { SeedUserKey } from './users.data';

export const SEED_RECIPE_KEYS = {
  CARBONARA: 'carbonara',
  TIRAMISU: 'tiramisu',
  PIZZA_PLATFORM: 'pizzaPlatform',
  BRUSCHETTA: 'bruschetta',
  GUACAMOLE: 'guacamole',
  RISOTTO: 'risotto',
  LENTILS_SOUP: 'lentilsSoup',
  SALMON_DISH: 'salmonDish',
  CHICKEN_CURRY: 'chickenCurry',
  BOEUF_BOURGUIGNON: 'boeufBourguignon',
  CAPRESE: 'caprese',
  BAKED_POTATOES: 'bakedPotatoes',
  RATATOUILLE: 'ratatouille',
  FONDANT: 'fondant',
  CHIA_PUDDING: 'chiaPudding',
  SMOOTHIE: 'smoothie',
  ESPRESSO_MARTINI: 'espressoMartini',
  AVOCADO_TOAST: 'avocadoToast',
  HUMMUS: 'hummus',
  CROISSANTS: 'croissants',
  PASTA_PESTO: 'pastaPesto',
  SHAKSHUKA: 'shakshuka',
  PAD_THAI: 'padThai',
  RAMEN: 'ramen',
  PAELLA: 'paella',
  FALAFEL: 'falafel',
  LASAGNA: 'lasagna',
  GNOCCHI: 'gnocchi',
  FOCACCIA: 'focaccia',
  CREME_BRULEE: 'cremeBrulee',
  PANCAKES: 'pancakes',
  MINESTRONE: 'minestrone',
} as const;

export type SeedRecipeKey =
  (typeof SEED_RECIPE_KEYS)[keyof typeof SEED_RECIPE_KEYS];

export interface SeedRecipeFixture {
  key: SeedRecipeKey;
  authorKey: SeedUserKey | null;
  ownerType: OwnerType;
  privacy: RecipePrivacy;
  isActive: boolean;
  sourceLang: 'it' | 'en' | 'fr';
  translationStatus: TranslationStatus;
  translationSource: Exclude<TranslationSource, 'author_original'>;
  course: Course;
  difficulty: RecipeDifficulty;
  prepTime: number;
  cookTime: number;
  servings: number;
  coverAsset?: string;
  videoAsset?: string;
  galleryAssets?: string[];
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
    duration: number;
    imageAsset?: string;
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
}

export const SHOWCASE_RECIPES: SeedRecipeFixture[] = [
  {
    key: 'carbonara',
    authorKey: 'mario_bianchi',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'it',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'first_course',
    difficulty: 'medium',
    prepTime: 15,
    cookTime: 10,
    servings: 4,
    coverAsset: 'carbonara.webp',
    galleryAssets: ['carbonara-gallery.webp'],
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
        duration: 10,
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
        unit: 'g',
        notes: {
          it: 'spaghetti trafilati al bronzo',
          en: 'bronze-die spaghetti',
          fr: 'spaghetti',
        },
      },
      {
        slug: 'guanciale',
        quantity: 160,
        unit: 'g',
      },
      {
        slug: 'eggs',
        quantity: 4,
        unit: 'piece',
        notes: {
          it: 'tuorli freschi',
          en: 'fresh yolks',
          fr: 'jaunes frais',
        },
      },
      {
        slug: 'pecorino',
        quantity: 90,
        unit: 'g',
        notes: {
          it: 'grattugiato finemente',
          en: 'finely grated',
          fr: 'finement râpé',
        },
      },
      {
        slug: 'black_pepper',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'tiramisu',
    authorKey: 'giuly_cooks',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'en',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'dessert',
    difficulty: 'easy',
    prepTime: 25,
    cookTime: 0,
    servings: 6,
    coverAsset: 'tiramisu.webp',
    videoAsset: 'seed-tutorial-2.mp4',
    galleryAssets: ['tiramisu-gallery.webp'],
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
        duration: 10,
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
      {
        slug: 'ladyfingers',
        quantity: 300,
        unit: 'g',
      },
      {
        slug: 'mascarpone',
        quantity: 500,
        unit: 'g',
      },
      {
        slug: 'eggs',
        quantity: 4,
        unit: 'piece',
      },
      {
        slug: 'coffee',
        quantity: 300,
        unit: 'ml',
        notes: {
          it: 'espresso amaro freddo',
          en: 'cold unsweetened espresso',
          fr: 'café espresso froid',
        },
      },
      {
        slug: 'sugar',
        quantity: 100,
        unit: 'g',
      },
      {
        slug: 'cocoa',
        quantity: 30,
        unit: 'g',
      },
    ],
  },
  {
    key: 'pizzaPlatform',
    authorKey: 'ex_utente',
    ownerType: 'platform',
    privacy: 'public',
    isActive: true,
    sourceLang: 'it',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'main_course',
    difficulty: 'hard',
    prepTime: 1440,
    cookTime: 15,
    servings: 4,
    coverAsset: 'pizza.webp',
    videoAsset: 'seed-tutorial-1.mp4',
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
      {
        slug: 'flour',
        quantity: 500,
        unit: 'g',
      },
      {
        slug: 'tomato',
        quantity: 250,
        unit: 'g',
      },
      {
        slug: 'mozzarella',
        quantity: 200,
        unit: 'g',
      },
      {
        slug: 'yeast',
        quantity: 3,
        unit: 'g',
      },
      {
        slug: 'olive_oil',
        quantity: 20,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 12,
        unit: 'g',
      },
      {
        slug: 'basil',
        quantity: 6,
        unit: 'piece',
      },
    ],
  },
  {
    key: 'bruschetta',
    authorKey: 'mario_bianchi',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'it',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'appetizer',
    difficulty: 'easy',
    prepTime: 7,
    cookTime: 3,
    servings: 4,
    coverAsset: 'bruschetta.webp',
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
        unit: 'piece',
        notes: {
          it: 'fette spesse di pane casereccio',
          en: 'thick artisan bread slices',
          fr: 'tranches épaisses de pain',
        },
      },
      {
        slug: 'tomato',
        quantity: 300,
        unit: 'g',
      },
      {
        slug: 'garlic',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'basil',
        quantity: 8,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 25,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'guacamole',
    authorKey: 'carlos_mex',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'en',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'snack',
    difficulty: 'easy',
    prepTime: 12,
    cookTime: 0,
    servings: 4,
    coverAsset: 'guacamole.webp',
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
        unit: 'piece',
        notes: {
          it: 'avocado Hass ben maturi',
          en: 'ripe Hass avocados',
          fr: 'avocats Hass mûrs',
        },
      },
      {
        slug: 'lime',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'cilantro',
        quantity: 10,
        unit: 'g',
      },
      {
        slug: 'onion',
        quantity: 50,
        unit: 'g',
      },
      {
        slug: 'tomato',
        quantity: 80,
        unit: 'g',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'risotto',
    authorKey: 'chef_marco',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'fr',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'first_course',
    difficulty: 'medium',
    prepTime: 10,
    cookTime: 25,
    servings: 4,
    coverAsset: 'risotto.webp',
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
        duration: 10,
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
      {
        slug: 'rice',
        quantity: 320,
        unit: 'g',
      },
      {
        slug: 'mushrooms',
        quantity: 250,
        unit: 'g',
      },
      {
        slug: 'white_wine',
        quantity: 100,
        unit: 'ml',
      },
      {
        slug: 'butter',
        quantity: 40,
        unit: 'g',
      },
      {
        slug: 'parmesan',
        quantity: 60,
        unit: 'g',
      },
      {
        slug: 'onion',
        quantity: 40,
        unit: 'g',
      },
      {
        slug: 'olive_oil',
        quantity: 20,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'lentilsSoup',
    authorKey: 'elena_vegan',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'it',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'first_course',
    difficulty: 'easy',
    prepTime: 10,
    cookTime: 35,
    servings: 4,
    coverAsset: 'lentils-soup.webp',
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
      {
        slug: 'lentils',
        quantity: 280,
        unit: 'g',
      },
      {
        slug: 'carrots',
        quantity: 120,
        unit: 'g',
      },
      {
        slug: 'onion',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'garlic',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'rosemary',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 30,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
      {
        slug: 'black_pepper',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'salmonDish',
    authorKey: 'giuly_cooks',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'en',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'main_course',
    difficulty: 'easy',
    prepTime: 10,
    cookTime: 15,
    servings: 2,
    coverAsset: 'salmon.webp',
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
        duration: 20,
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
      {
        slug: 'salmon',
        quantity: 360,
        unit: 'g',
      },
      {
        slug: 'lemon',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'garlic',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 20,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
      {
        slug: 'black_pepper',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'chickenCurry',
    authorKey: 'kenji_noodles',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'fr',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'main_course',
    difficulty: 'medium',
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    coverAsset: 'chicken-curry.webp',
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
        duration: 30,
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
      {
        slug: 'chicken_breast',
        quantity: 500,
        unit: 'g',
      },
      {
        slug: 'coconut_milk',
        quantity: 350,
        unit: 'ml',
      },
      {
        slug: 'curry_powder',
        quantity: 2,
        unit: 'tbsp',
      },
      {
        slug: 'onion',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'garlic',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 20,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'boeufBourguignon',
    authorKey: 'sophie_pastry',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'it',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'main_course',
    difficulty: 'hard',
    prepTime: 30,
    cookTime: 165,
    servings: 6,
    coverAsset: 'boeuf-bourguignon.webp',
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
        duration: 25,
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
      {
        slug: 'beef_chuck',
        quantity: 900,
        unit: 'g',
      },
      {
        slug: 'red_wine',
        quantity: 500,
        unit: 'ml',
      },
      {
        slug: 'carrots',
        quantity: 200,
        unit: 'g',
      },
      {
        slug: 'mushrooms',
        quantity: 200,
        unit: 'g',
      },
      {
        slug: 'onion',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'garlic',
        quantity: 3,
        unit: 'piece',
      },
      {
        slug: 'flour',
        quantity: 20,
        unit: 'g',
      },
      {
        slug: 'olive_oil',
        quantity: 30,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'caprese',
    authorKey: 'mario_bianchi',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'en',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'side_dish',
    difficulty: 'easy',
    prepTime: 10,
    cookTime: 0,
    servings: 4,
    coverAsset: 'caprese.webp',
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
      {
        slug: 'tomato',
        quantity: 400,
        unit: 'g',
      },
      {
        slug: 'mozzarella',
        quantity: 250,
        unit: 'g',
      },
      {
        slug: 'basil',
        quantity: 12,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 30,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'bakedPotatoes',
    authorKey: 'ex_utente',
    ownerType: 'platform',
    privacy: 'public',
    isActive: true,
    sourceLang: 'fr',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'side_dish',
    difficulty: 'easy',
    prepTime: 10,
    cookTime: 40,
    servings: 4,
    coverAsset: 'baked-potatoes.webp',
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
      {
        slug: 'potatoes',
        quantity: 800,
        unit: 'g',
      },
      {
        slug: 'rosemary',
        quantity: 3,
        unit: 'piece',
      },
      {
        slug: 'garlic',
        quantity: 3,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 40,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
      {
        slug: 'black_pepper',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'ratatouille',
    authorKey: 'sophie_pastry',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'it',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'side_dish',
    difficulty: 'medium',
    prepTime: 25,
    cookTime: 40,
    servings: 4,
    coverAsset: 'ratatouille.webp',
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
        duration: 50,
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
      {
        slug: 'eggplant',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'zucchini',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'tomato',
        quantity: 3,
        unit: 'piece',
      },
      {
        slug: 'bell_pepper',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'onion',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'garlic',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 30,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'fondant',
    authorKey: 'sophie_pastry',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'en',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'dessert',
    difficulty: 'medium',
    prepTime: 15,
    cookTime: 10,
    servings: 4,
    coverAsset: 'fondant.webp',
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
      {
        slug: 'dark_chocolate',
        quantity: 150,
        unit: 'g',
      },
      {
        slug: 'butter',
        quantity: 100,
        unit: 'g',
      },
      {
        slug: 'eggs',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'sugar',
        quantity: 60,
        unit: 'g',
      },
      {
        slug: 'flour',
        quantity: 30,
        unit: 'g',
      },
    ],
  },
  {
    key: 'chiaPudding',
    authorKey: 'elena_vegan',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'fr',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'dessert',
    difficulty: 'easy',
    prepTime: 15,
    cookTime: 0,
    servings: 2,
    coverAsset: 'chia-pudding.webp',
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
      {
        slug: 'chia_seeds',
        quantity: 50,
        unit: 'g',
      },
      {
        slug: 'coconut_milk',
        quantity: 250,
        unit: 'ml',
      },
      {
        slug: 'berries',
        quantity: 100,
        unit: 'g',
      },
      {
        slug: 'sugar',
        quantity: 20,
        unit: 'g',
      },
      {
        slug: 'vanilla',
        quantity: 1,
        unit: 'tsp',
      },
    ],
  },
  {
    key: 'smoothie',
    authorKey: 'elena_vegan',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'it',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'drink',
    difficulty: 'easy',
    prepTime: 5,
    cookTime: 0,
    servings: 2,
    coverAsset: 'smoothie.webp',
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
      {
        slug: 'banana',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'walnuts',
        quantity: 40,
        unit: 'g',
      },
      {
        slug: 'milk',
        quantity: 300,
        unit: 'ml',
      },
      {
        slug: 'vanilla',
        quantity: 1,
        unit: 'tsp',
      },
    ],
  },
  {
    key: 'espressoMartini',
    authorKey: 'chef_marco',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'en',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'drink',
    difficulty: 'medium',
    prepTime: 7,
    cookTime: 0,
    servings: 2,
    coverAsset: 'espresso-martini.webp',
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
        unit: 'ml',
        notes: {
          it: 'espresso appena estratto',
          en: 'freshly pulled espresso',
          fr: 'espresso chaud fraîchement extrait',
        },
      },
      {
        slug: 'vodka',
        quantity: 100,
        unit: 'ml',
      },
      {
        slug: 'coffee_liqueur',
        quantity: 40,
        unit: 'ml',
      },
      {
        slug: 'sugar',
        quantity: 15,
        unit: 'g',
      },
    ],
  },
  {
    key: 'avocadoToast',
    authorKey: 'giuly_cooks',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'fr',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'snack',
    difficulty: 'easy',
    prepTime: 5,
    cookTime: 10,
    servings: 2,
    coverAsset: 'avocado-toast.webp',
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
      {
        slug: 'bread',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'avocado',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'eggs',
        quantity: 2,
        unit: 'piece',
      },
      {
        slug: 'lemon',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 15,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
      {
        slug: 'black_pepper',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'hummus',
    authorKey: 'carlos_mex',
    ownerType: 'user',
    privacy: 'public',
    isActive: true,
    sourceLang: 'it',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'snack',
    difficulty: 'easy',
    prepTime: 15,
    cookTime: 0,
    servings: 4,
    coverAsset: 'hummus.webp',
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
      {
        slug: 'chickpeas',
        quantity: 400,
        unit: 'g',
      },
      {
        slug: 'tahini',
        quantity: 60,
        unit: 'g',
      },
      {
        slug: 'lemon',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'garlic',
        quantity: 1,
        unit: 'piece',
      },
      {
        slug: 'olive_oil',
        quantity: 40,
        unit: 'ml',
      },
      {
        slug: 'salt',
        quantity: 1,
        unit: 'pinch',
      },
    ],
  },
  {
    key: 'croissants',
    authorKey: 'ex_utente',
    ownerType: 'platform',
    privacy: 'public',
    isActive: true,
    sourceLang: 'en',
    translationStatus: 'completed',
    translationSource: TranslationSource.manual,
    course: 'dessert',
    difficulty: 'hard',
    prepTime: 680,
    cookTime: 40,
    servings: 8,
    coverAsset: 'croissants.webp',
    videoAsset: 'seed-tutorial-2.mp4',
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
      {
        slug: 'flour',
        quantity: 500,
        unit: 'g',
      },
      {
        slug: 'butter',
        quantity: 280,
        unit: 'g',
      },
      {
        slug: 'milk',
        quantity: 150,
        unit: 'ml',
      },
      {
        slug: 'sugar',
        quantity: 60,
        unit: 'g',
      },
      {
        slug: 'yeast',
        quantity: 10,
        unit: 'g',
      },
      {
        slug: 'salt',
        quantity: 10,
        unit: 'g',
      },
      {
        slug: 'eggs',
        quantity: 1,
        unit: 'piece',
        notes: {
          it: 'per la doratura',
          en: 'for egg wash',
          fr: 'pour la dorure',
        },
      },
    ],
  },
] as SeedRecipeFixture[];

export const PAGE_TWO_CURATED_RECIPES: SeedRecipeFixture[] = [
  {
    key: 'pastaPesto',
    authorKey: 'lorenzo_ferri',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.public,
    isActive: true,
    sourceLang: 'it',
    translationStatus: TranslationStatus.failed,
    translationSource: TranslationSource.machine,
    course: Course.main_course,
    difficulty: RecipeDifficulty.easy,
    prepTime: 15,
    cookTime: 10,
    servings: 4,
    coverAsset: 'pasta-pesto.webp',
    tagSlugs: ['vegetarian', 'traditional', 'quick_easy'],
    translations: {
      it: {
        title: 'Trofie al Pesto Genovese',
        description:
          'Pasta fresca condita con pesto di basilico, pinoli tostati, aglio e Parmigiano.',
        tips: 'Diluisci il pesto con un mestolo di acqua di cottura prima di mantecare.',
        preservation:
          'Consumare subito; il pesto si conserva in frigo coperto d’olio per 3 giorni.',
      },
      en: {
        title: 'Trofie Pasta with Basil Pesto',
        description:
          'Fresh pasta tossed in fragrant Genovese basil pesto with pine nuts and Parmesan.',
        tips: 'Loosen the pesto with starchy pasta water off the heat so the basil stays bright green.',
        preservation:
          'Best served immediately; store extra pesto under olive oil for 3 days.',
      },
      fr: {
        title: 'Trofie au Pesto Génois',
        description:
          'Pâtes fraîches nappées de pesto au basilic, pignons de pin, ail et parmesan.',
        tips: 'Détendez le pesto avec une louche d’eau de cuisson hors du feu.',
        preservation: 'À déguster immédiatement.',
      },
    },
    steps: [
      {
        duration: 15,
        translations: {
          it: {
            title: 'Preparazione del pesto',
            description:
              'Frulla o pesta basilico, pinoli, aglio, formaggio e olio extravergine.',
          },
          en: {
            title: 'Make the pesto',
            description:
              'Blend or pound basil, pine nuts, garlic, Parmesan, and olive oil until emulsified.',
          },
          fr: {
            title: 'Préparer le pesto',
            description:
              'Mixer ou piler basilic, pignons, ail, parmesan et huile d’olive.',
          },
        },
      },
      {
        duration: 10,
        translations: {
          it: {
            title: 'Cottura e mantecatura',
            description:
              'Cuoci la pasta al dente e manteca lontano dal fuoco con il pesto.',
          },
          en: {
            title: 'Boil and toss',
            description:
              'Cook pasta al dente and toss off the heat with pesto and pasta water.',
          },
          fr: {
            title: 'Cuire et enrober',
            description:
              'Cuire les pâtes al dente et mélanger hors du feu avec le pesto.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'pasta', quantity: 360, unit: UnitOfMeasure.g },
      { slug: 'basil', quantity: 60, unit: UnitOfMeasure.g },
      { slug: 'pine-nuts', quantity: 30, unit: UnitOfMeasure.g },
      { slug: 'parmesan', quantity: 70, unit: UnitOfMeasure.g },
      { slug: 'olive-oil', quantity: 80, unit: UnitOfMeasure.ml },
      { slug: 'garlic', quantity: 1, unit: UnitOfMeasure.piece },
    ],
  },
  {
    key: 'shakshuka',
    authorKey: 'chiara_bellini',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.public,
    isActive: true,
    sourceLang: 'en',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.main_course,
    difficulty: RecipeDifficulty.easy,
    prepTime: 10,
    cookTime: 20,
    servings: 3,
    coverAsset: 'shakshuka.webp',
    tagSlugs: ['vegetarian', 'gluten_free', 'comfort_food'],
    translations: {
      it: {
        title: 'Shakshuka Speziata',
        description:
          'Uova in camicia cotte in una padella di pomodori, peperoni, cumino e paprika.',
        tips: 'Copri la padella negli ultimi minuti per cuocere l’albume lasciando il tuorlo morbido.',
      },
      en: {
        title: 'Spiced Skillet Shakshuka',
        description:
          'Poached eggs simmered in a smoky tomato and bell pepper sauce with cumin and paprika.',
        tips: 'Cover the skillet briefly at the end to set the whites while keeping yolks runny.',
      },
      fr: {
        title: 'Shakshuka aux Épices',
        description:
          'Œufs pochés dans une sauce tomate aux poivrons, cumin et paprika fumé.',
        tips: 'Couvrez la poêle en fin de cuisson pour garder les jaunes coulants.',
      },
    },
    steps: [
      {
        duration: 10,
        translations: {
          it: {
            title: 'Soffritto di verdure',
            description:
              'Taglia cipolla e peperone e rosola con aglio, cumino e paprika.',
          },
          en: {
            title: 'Sauté aromatics',
            description:
              'Dice onion and bell pepper, then sauté with garlic, cumin, and paprika.',
          },
          fr: {
            title: 'Faire revenir',
            description:
              'Faire revenir oignon, poivron, ail, cumin et paprika.',
          },
        },
      },
      {
        duration: 20,
        translations: {
          it: {
            title: 'Salsa e uova',
            description:
              'Aggiungi i pomodori, restringi la salsa e cuoci le uova nei nidi.',
          },
          en: {
            title: 'Simmer & poach',
            description:
              'Simmer crushed tomatoes, crack eggs into wells, and poach until set.',
          },
          fr: {
            title: 'Mijoter et pocher',
            description:
              'Ajouter les tomates, creuser des puits et pocher les œufs.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'eggs', quantity: 6, unit: UnitOfMeasure.piece },
      { slug: 'tomato', quantity: 500, unit: UnitOfMeasure.g },
      { slug: 'bell_pepper', quantity: 150, unit: UnitOfMeasure.g },
      { slug: 'onion', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'cumin', quantity: 1, unit: UnitOfMeasure.tsp },
      { slug: 'paprika', quantity: 1, unit: UnitOfMeasure.tsp },
    ],
  },
  {
    key: 'padThai',
    authorKey: 'kenji_noodles',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.public,
    isActive: true,
    sourceLang: 'en',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.main_course,
    difficulty: RecipeDifficulty.medium,
    prepTime: 15,
    cookTime: 15,
    servings: 2,
    coverAsset: 'pad-thai.webp',
    tagSlugs: ['dairy_free', 'quick_easy'],
    translations: {
      it: {
        title: 'Pad Thai con Gamberi',
        description:
          'Spaghetti di riso saltati al wok con gamberi, uova, salsa di soia, lime e arachidi.',
      },
      en: {
        title: 'Classic Shrimp Pad Thai',
        description:
          'Wok-tossed rice noodles with prawns, scrambled egg, tangy lime, and crushed peanuts.',
      },
      fr: {
        title: 'Pad Thaï aux Crevettes',
        description:
          'Nouilles de riz sautées au wok avec crevettes, œuf, citron vert et cacahuètes.',
      },
    },
    steps: [
      {
        duration: 15,
        translations: {
          it: {
            title: 'Ammollo dei noodles',
            description:
              'Ammolla i noodles di riso in acqua tiepida e prepara gli ingredienti.',
          },
          en: {
            title: 'Soak & prep',
            description:
              'Soak rice noodles in warm water and prep prawns, garlic, and peanuts.',
          },
          fr: {
            title: 'Trempage et préparation',
            description:
              'Faire tremper les nouilles de riz et préparer les crevettes.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Salto al wok',
            description:
              'Rosola i gamberi, aggiungi uova, noodles e salsa, poi guarnisci con lime e arachidi.',
          },
          en: {
            title: 'Wok stir-fry',
            description:
              'Sear prawns, scramble egg, toss noodles with sauce, and finish with lime and peanuts.',
          },
          fr: {
            title: 'Sauter au wok',
            description:
              'Saisir les crevettes, ajouter œuf, nouilles, sauce et cacahuètes.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'rice-noodles', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'prawns', quantity: 220, unit: UnitOfMeasure.g },
      { slug: 'eggs', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'peanut', quantity: 40, unit: UnitOfMeasure.g },
      { slug: 'lime', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'dark-soy-sauce', quantity: 2, unit: UnitOfMeasure.tbsp },
    ],
  },
  {
    key: 'ramen',
    authorKey: 'kenji_noodles',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.friends_only,
    isActive: true,
    sourceLang: 'en',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.main_course,
    difficulty: RecipeDifficulty.hard,
    prepTime: 25,
    cookTime: 35,
    servings: 2,
    coverAsset: 'ramen.webp',
    tagSlugs: ['comfort_food', 'winter'],
    translations: {
      it: {
        title: 'Ramen Fumante con Uovo Marinato',
        description:
          'Brodo saporito con zenzero, funghi shiitake, pollo arrosto, noodles e uovo morbido.',
      },
      en: {
        title: 'Savory Miso & Ginger Ramen',
        description:
          'Rich aromatic broth with ginger, mushrooms, sliced chicken, springy noodles, and soft egg.',
      },
      fr: {
        title: 'Ramen au Gingembre et Œuf Mollet',
        description:
          'Bouillon parfumé au gingembre, champignons, poulet rôti, nouilles et œuf mollet.',
      },
    },
    steps: [
      {
        duration: 25,
        translations: {
          it: {
            title: 'Base aromatica',
            description:
              'Prepara aglio, zenzero, cipollotto, funghi e cuoci le uova per 6 minuti e mezzo.',
          },
          en: {
            title: 'Prep aromatics & soft eggs',
            description:
              'Slice ginger, garlic, mushrooms, and boil eggs for 6.5 minutes.',
          },
          fr: {
            title: 'Préparer garnitures et œufs',
            description:
              'Émincer gingembre, champignons et cuire les œufs mollets 6 min 30.',
          },
        },
      },
      {
        duration: 35,
        translations: {
          it: {
            title: 'Brodo e assemblaggio',
            description:
              'Sobbolli il brodo, cuoci i noodles e componi la ciotola ben calda.',
          },
          en: {
            title: 'Simmer broth & assemble',
            description:
              'Simmer broth with soy and mushrooms, cook noodles, and assemble hot bowls.',
          },
          fr: {
            title: 'Mijoter et dresser',
            description:
              'Laisser mijoter le bouillon, cuire les nouilles et dresser.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'noodle', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'chicken_breast', quantity: 250, unit: UnitOfMeasure.g },
      { slug: 'eggs', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'mushroom', quantity: 120, unit: UnitOfMeasure.g },
      { slug: 'ginger', quantity: 20, unit: UnitOfMeasure.g },
      { slug: 'spring-onion', quantity: 2, unit: UnitOfMeasure.piece },
      { slug: 'dark-soy-sauce', quantity: 3, unit: UnitOfMeasure.tbsp },
    ],
  },
  {
    key: 'paella',
    authorKey: 'giuly_cooks',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.friends_only,
    isActive: true,
    sourceLang: 'en',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.machine,
    course: Course.main_course,
    difficulty: RecipeDifficulty.hard,
    prepTime: 20,
    cookTime: 35,
    servings: 4,
    coverAsset: 'paella.webp',
    tagSlugs: ['gluten_free', 'dairy_free', 'traditional'],
    translations: {
      it: {
        title: 'Paella ai Frutti di Mare',
        description:
          'Riso dorato cotto in padella larga con gamberi, cozze, peperoni e curcuma.',
      },
      en: {
        title: 'Coastal Seafood Paella',
        description:
          'Crisp-bottomed golden rice simmered with prawns, mussels, sweet peppers, and garlic.',
      },
      fr: {
        title: 'Paella aux Fruits de Mer',
        description:
          'Riz doré cuit à la poêle avec crevettes, moules, poivrons doux et ail.',
      },
    },
    steps: [
      {
        duration: 20,
        translations: {
          it: {
            title: 'Pulizia e soffritto',
            description:
              'Pulisci cozze e gamberi, poi prepara il soffritto di cipolla, aglio e peperone.',
          },
          en: {
            title: 'Clean seafood & sofrito',
            description:
              'Clean mussels and prawns, then sauté onion, garlic, and bell pepper.',
          },
          fr: {
            title: 'Préparer les fruits de mer',
            description:
              'Nettoyer moules et crevettes, puis faire revenir le sofrito.',
          },
        },
      },
      {
        duration: 35,
        translations: {
          it: {
            title: 'Cottura del riso',
            description:
              'Tosta il riso, aggiungi il brodo e disponi i frutti di mare senza mescolare.',
          },
          en: {
            title: 'Simmer rice & seafood',
            description:
              'Toast rice, add warm stock, and nestle seafood on top until socarrat forms.',
          },
          fr: {
            title: 'Cuire le riz',
            description:
              'Nacrer le riz, mouiller au bouillon et disposer les fruits de mer.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'rice', quantity: 350, unit: UnitOfMeasure.g },
      { slug: 'prawns', quantity: 250, unit: UnitOfMeasure.g },
      { slug: 'mussel', quantity: 300, unit: UnitOfMeasure.g },
      { slug: 'bell_pepper', quantity: 150, unit: UnitOfMeasure.g },
      { slug: 'tomato', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'garlic', quantity: 3, unit: UnitOfMeasure.piece },
    ],
  },
  {
    key: 'falafel',
    authorKey: 'hannah_fischer',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.friends_only,
    isActive: true,
    sourceLang: 'en',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.appetizer,
    difficulty: RecipeDifficulty.medium,
    prepTime: 20,
    cookTime: 15,
    servings: 4,
    coverAsset: 'falafel.webp',
    tagSlugs: ['vegan', 'dairy_free', 'budget_friendly'],
    translations: {
      it: {
        title: 'Falafel Croccanti alle Erbe',
        description:
          'Polpettine di ceci speziate con prezzemolo, coriandolo, aglio e cumino.',
      },
      en: {
        title: 'Crispy Herb Chickpea Falafel',
        description:
          'Golden chickpea fritters packed with fresh parsley, cilantro, garlic, and warm cumin.',
      },
      fr: {
        title: 'Falafels Croustillants aux Herbes',
        description:
          'Boulettes de pois chiches dorées au persil, coriandre, ail et cumin.',
      },
    },
    steps: [
      {
        duration: 20,
        translations: {
          it: {
            title: 'Impasto di ceci',
            description:
              'Frulla grossolanamente ceci, erbe, cipolla, aglio e spezie e forma le polpette.',
          },
          en: {
            title: 'Blend & shape',
            description:
              'Pulse chickpeas, herbs, onion, garlic, and cumin, then form small patties.',
          },
          fr: {
            title: 'Mixer et façonner',
            description:
              'Mixer pois chiches, herbes, ail et cumin puis former des boulettes.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Cottura dorata',
            description:
              'Cuoci in padella o al forno finché non risultano croccanti fuori.',
          },
          en: {
            title: 'Crisp until golden',
            description:
              'Pan-fry or bake in olive oil until crisp and deeply golden outside.',
          },
          fr: {
            title: 'Dorer',
            description:
              'Cuire à la poêle ou au four jusqu’à ce qu’ils soient bien dorés.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'chickpeas', quantity: 400, unit: UnitOfMeasure.g },
      { slug: 'parsley', quantity: 30, unit: UnitOfMeasure.g },
      { slug: 'garlic', quantity: 3, unit: UnitOfMeasure.piece },
      { slug: 'onion', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'cumin', quantity: 2, unit: UnitOfMeasure.tsp },
      { slug: 'olive-oil', quantity: 4, unit: UnitOfMeasure.tbsp },
    ],
  },
  {
    key: 'lasagna',
    authorKey: 'tiago_silva',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.friends_only,
    isActive: true,
    sourceLang: 'it',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.main_course,
    difficulty: RecipeDifficulty.medium,
    prepTime: 30,
    cookTime: 45,
    servings: 6,
    coverAsset: 'lasagna.webp',
    tagSlugs: ['traditional', 'comfort_food'],
    translations: {
      it: {
        title: 'Lasagne alla Bolognese',
        description:
          'Strati di pasta all’uovo con ragù di manzo, besciamella vellutata e Parmigiano gratinato.',
      },
      en: {
        title: 'Classic Beef Lasagna al Forno',
        description:
          'Layered pasta sheets baked with slow-simmered beef ragù, creamy béchamel, and Parmesan.',
      },
      fr: {
        title: 'Lasagnes à la Bolognaise',
        description:
          'Couches de pâtes, ragoût de bœuf mijoté, béchamel onctueuse et parmesan gratiné.',
      },
    },
    steps: [
      {
        duration: 30,
        translations: {
          it: {
            title: 'Ragù e besciamella',
            description:
              'Prepara il ragù di manzo con pomodoro e la besciamella con burro, farina e latte.',
          },
          en: {
            title: 'Ragù & béchamel',
            description:
              'Simmer beef ragù with tomatoes and whisk butter, flour, and milk into béchamel.',
          },
          fr: {
            title: 'Ragoût et béchamel',
            description: 'Préparer le ragoût de bœuf et la sauce béchamel.',
          },
        },
      },
      {
        duration: 45,
        translations: {
          it: {
            title: 'Assemblaggio e forno',
            description:
              'Alterna pasta, ragù, besciamella e Parmigiano, poi inforna fino a gratinatura.',
          },
          en: {
            title: 'Layer & bake',
            description:
              'Layer pasta, ragù, béchamel, and Parmesan, then bake until bubbling and golden.',
          },
          fr: {
            title: 'Monter et gratiner',
            description:
              'Alterner les couches et enfourner jusqu’à belle coloration.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'pasta', quantity: 350, unit: UnitOfMeasure.g },
      { slug: 'beef_mince', quantity: 500, unit: UnitOfMeasure.g },
      { slug: 'tomato', quantity: 600, unit: UnitOfMeasure.g },
      { slug: 'milk', quantity: 500, unit: UnitOfMeasure.ml },
      { slug: 'butter', quantity: 50, unit: UnitOfMeasure.g },
      { slug: 'flour', quantity: 50, unit: UnitOfMeasure.g },
      { slug: 'parmesan', quantity: 100, unit: UnitOfMeasure.g },
    ],
  },
  {
    key: 'gnocchi',
    authorKey: 'hannah_fischer',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.private,
    isActive: true,
    sourceLang: 'it',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.main_course,
    difficulty: RecipeDifficulty.medium,
    prepTime: 25,
    cookTime: 20,
    servings: 4,
    coverAsset: 'gnocchi.webp',
    tagSlugs: ['vegetarian', 'comfort_food', 'traditional'],
    translations: {
      it: {
        title: 'Gnocchi alla Sorrentina',
        description:
          'Morbidi gnocchi di patate al forno con salsa di pomodoro, basilico fresco e mozzarella filante.',
      },
      en: {
        title: 'Baked Gnocchi alla Sorrentina',
        description:
          'Pillow-soft potato gnocchi baked in sweet tomato sauce with fresh basil and melted mozzarella.',
      },
      fr: {
        title: 'Gnocchi à la Sorrentina',
        description:
          'Gnocchis de pommes de terre gratinés à la sauce tomate, basilic et mozzarella fondante.',
      },
    },
    steps: [
      {
        duration: 25,
        translations: {
          it: {
            title: 'Impasto degli gnocchi',
            description:
              'Lessa e schiaccia le patate, impasta con farina e forma i bocconcini.',
          },
          en: {
            title: 'Shape potato gnocchi',
            description:
              'Boil and mash potatoes, knead lightly with flour, and roll into gnocchi.',
          },
          fr: {
            title: 'Façonner les gnocchis',
            description:
              'Écraser les pommes de terre cuites avec la farine et découper les gnocchis.',
          },
        },
      },
      {
        duration: 20,
        translations: {
          it: {
            title: 'Salsa e gratinatura',
            description:
              'Cuoci gli gnocchi, condisci con sugo e mozzarella e gratina in forno.',
          },
          en: {
            title: 'Sauce & bake',
            description:
              'Boil gnocchi until they float, toss with tomato sauce and mozzarella, and broil.',
          },
          fr: {
            title: 'Napper et gratiner',
            description:
              'Pocher les gnocchis, napper de sauce tomate et mozzarella puis gratiner.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'potato', quantity: 800, unit: UnitOfMeasure.g },
      { slug: 'flour', quantity: 220, unit: UnitOfMeasure.g },
      { slug: 'tomato', quantity: 450, unit: UnitOfMeasure.g },
      { slug: 'mozzarella', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'basil', quantity: 15, unit: UnitOfMeasure.g },
    ],
  },
  {
    key: 'focaccia',
    authorKey: 'matteo_galli',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.private,
    isActive: true,
    sourceLang: 'it',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.side_dish,
    difficulty: RecipeDifficulty.medium,
    prepTime: 25,
    cookTime: 25,
    servings: 6,
    coverAsset: 'focaccia.webp',
    tagSlugs: ['vegan', 'traditional'],
    translations: {
      it: {
        title: 'Focaccia Genovese al Rosmarino',
        description:
          'Impasto soffice e alveolato con emulsione di acqua, olio extravergine, sale grosso e rosmarino.',
      },
      en: {
        title: 'Rosemary & Olive Oil Focaccia',
        description:
          'Crisp-edged, airy Italian flatbread dimpled with extra-virgin olive oil and rosemary.',
      },
      fr: {
        title: 'Focaccia au Romarin',
        description:
          'Pain plat moelleux et doré à l’huile d’olive vierge extra, fleur de sel et romarin.',
      },
    },
    steps: [
      {
        duration: 25,
        translations: {
          it: {
            title: 'Impasto e stesura',
            description:
              'Impasta farina, acqua, lievito e olio, fai lievitare e stendi in teglia.',
          },
          en: {
            title: 'Knead & dimple',
            description:
              'Knead flour, water, yeast, and olive oil, proof, and dimple into an oiled pan.',
          },
          fr: {
            title: 'Pétrir et étaler',
            description:
              'Pétrir la pâte, laisser lever et former les alvéoles dans le plat huilé.',
          },
        },
      },
      {
        duration: 25,
        translations: {
          it: {
            title: 'Cottura croccante',
            description:
              'Distribuisci rosmarino e salamoia, poi cuoci a 220°C fino a doratura.',
          },
          en: {
            title: 'Bake until golden',
            description:
              'Scatter rosemary and sea salt, then bake at 220°C until crisp and golden.',
          },
          fr: {
            title: 'Cuire au four',
            description:
              'Parsemer de romarin et cuire à 220°C jusqu’à belle croûte dorée.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'flour', quantity: 500, unit: UnitOfMeasure.g },
      { slug: 'olive-oil', quantity: 60, unit: UnitOfMeasure.ml },
      { slug: 'yeast', quantity: 7, unit: UnitOfMeasure.g },
      { slug: 'rosemary', quantity: 10, unit: UnitOfMeasure.g },
      { slug: 'salt', quantity: 10, unit: UnitOfMeasure.g },
    ],
  },
  {
    key: 'cremeBrulee',
    authorKey: 'sophie_pastry',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.private,
    isActive: true,
    sourceLang: 'fr',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.dessert,
    difficulty: RecipeDifficulty.medium,
    prepTime: 15,
    cookTime: 40,
    servings: 4,
    coverAsset: 'creme-brulee.webp',
    tagSlugs: ['gluten_free', 'traditional'],
    translations: {
      it: {
        title: 'Crème Brûlée alla Vaniglia',
        description:
          'Crema cotta vellutata alla vaniglia con crosticina croccante di zucchero caramellato.',
      },
      en: {
        title: 'Classic Vanilla Crème Brûlée',
        description:
          'Silky baked vanilla bean custard topped with a shattering caramelized sugar crust.',
      },
      fr: {
        title: 'Crème Brûlée à la Vanille',
        description:
          'Crème onctueuse infusée à la vanille recouverte d’une fine couche de caramel craquant.',
      },
    },
    steps: [
      {
        duration: 15,
        translations: {
          it: {
            title: 'Infusione e crema',
            description:
              'Scalda panna e vaniglia, poi incorpora i tuorli sbattuti con lo zucchero.',
          },
          en: {
            title: 'Infuse & whisk',
            description:
              'Steep vanilla in warm cream, then temper into whisked egg yolks and sugar.',
          },
          fr: {
            title: 'Infuser et mélanger',
            description:
              'Chauffer crème et vanille, puis verser sur les jaunes blanchis.',
          },
        },
      },
      {
        duration: 40,
        translations: {
          it: {
            title: 'Bagnomaria e caramello',
            description:
              'Cuoci a bagnomaria in forno, raffredda e caramella lo zucchero in superficie.',
          },
          en: {
            title: 'Water bath & torch',
            description:
              'Bake in a water bath until gently set, chill, and torch sugar until crisp.',
          },
          fr: {
            title: 'Bain-marie et caramélisation',
            description:
              'Cuire au bain-marie, refroidir et caraméliser au chalumeau.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'cream', quantity: 400, unit: UnitOfMeasure.ml },
      { slug: 'eggs', quantity: 5, unit: UnitOfMeasure.piece },
      { slug: 'sugar', quantity: 80, unit: UnitOfMeasure.g },
      { slug: 'vanilla', quantity: 1, unit: UnitOfMeasure.tsp },
    ],
  },
  {
    key: 'pancakes',
    authorKey: 'repeat_offender_active',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.public,
    isActive: false,
    sourceLang: 'en',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.machine,
    course: Course.snack,
    difficulty: RecipeDifficulty.easy,
    prepTime: 10,
    cookTime: 15,
    servings: 3,
    coverAsset: 'pancakes.webp',
    tagSlugs: ['vegetarian', 'quick_easy', 'comfort_food'],
    translations: {
      it: {
        title: 'Pancake Soffici al Miele',
        description:
          'Torretta di pancake dorati serviti con burro fuso e miele millefiori.',
      },
      en: {
        title: 'Fluffy Golden Pancakes',
        description:
          'Light and airy griddle pancakes stacked high with melted butter and warm honey.',
      },
      fr: {
        title: 'Pancakes Moelleux au Miel',
        description:
          'Pile de pancakes dorés servis avec du beurre fondant et du miel.',
      },
    },
    steps: [
      {
        duration: 10,
        translations: {
          it: {
            title: 'Pastella veloce',
            description:
              'Mescola farina, lievito, zucchero, latte, uovo e burro fuso.',
          },
          en: {
            title: 'Whisk batter',
            description:
              'Combine flour, baking powder, sugar, milk, egg, and melted butter.',
          },
          fr: {
            title: 'Préparer la pâte',
            description:
              'Mélanger farine, levure, sucre, lait, œuf et beurre fondu.',
          },
        },
      },
      {
        duration: 15,
        translations: {
          it: {
            title: 'Cottura in padella',
            description:
              'Cuoci i pancake un paio di minuti per lato fino a doratura.',
          },
          en: {
            title: 'Griddle until golden',
            description:
              'Cook ladlefuls on a warm skillet until bubbles form, flip, and serve with honey.',
          },
          fr: {
            title: 'Cuire à la poêle',
            description: 'Cuire chaque face jusqu’à belle coloration dorée.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'flour', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'baking-powder', quantity: 2, unit: UnitOfMeasure.tsp },
      { slug: 'milk', quantity: 250, unit: UnitOfMeasure.ml },
      { slug: 'eggs', quantity: 1, unit: UnitOfMeasure.piece },
      { slug: 'butter', quantity: 30, unit: UnitOfMeasure.g },
      { slug: 'honey', quantity: 3, unit: UnitOfMeasure.tbsp },
    ],
  },
  {
    key: 'minestrone',
    authorKey: 'lukas_weber',
    ownerType: OwnerType.user,
    privacy: RecipePrivacy.public,
    isActive: false,
    sourceLang: 'it',
    translationStatus: TranslationStatus.completed,
    translationSource: TranslationSource.manual,
    course: Course.main_course,
    difficulty: RecipeDifficulty.easy,
    prepTime: 15,
    cookTime: 35,
    servings: 4,
    coverAsset: 'minestrone.webp',
    tagSlugs: ['vegan', 'gluten_free', 'winter', 'budget_friendly'],
    translations: {
      it: {
        title: 'Minestrone della Tradizione',
        description:
          'Zuppa ricca di verdure di stagione, fagioli e patate profumata al rosmarino.',
      },
      en: {
        title: 'Hearty Garden Minestrone',
        description:
          'Wholesome vegetable soup simmered with carrots, celery, zucchini, potatoes, and beans.',
      },
      fr: {
        title: 'Minestrone Traditionnel aux Légumes',
        description:
          'Soupe généreuse aux légumes de saison, haricots et pommes de terre.',
      },
    },
    steps: [
      {
        duration: 15,
        translations: {
          it: {
            title: 'Taglio delle verdure',
            description:
              'Taglia a dadini carote, sedano, zucchine, patate e cipolla.',
          },
          en: {
            title: 'Chop vegetables',
            description:
              'Dice carrots, celery, zucchini, potatoes, and onion evenly.',
          },
          fr: {
            title: 'Couper les légumes',
            description:
              'Tailler carottes, céleri, courgettes, pommes de terre et oignon en dés.',
          },
        },
      },
      {
        duration: 35,
        translations: {
          it: {
            title: 'Lenta cottura',
            description:
              'Rosola il soffritto, aggiungi verdure, fagioli e acqua e sobbolli per 35 minuti.',
          },
          en: {
            title: 'Simmer slowly',
            description:
              'Sauté aromatics, add diced vegetables, beans, and water, and simmer gently.',
          },
          fr: {
            title: 'Mijoter doucement',
            description:
              'Faire revenir les aromates, ajouter légumes et haricots et laisser mijoter.',
          },
        },
      },
    ],
    ingredients: [
      { slug: 'carrot', quantity: 150, unit: UnitOfMeasure.g },
      { slug: 'celery', quantity: 100, unit: UnitOfMeasure.g },
      { slug: 'zucchini', quantity: 180, unit: UnitOfMeasure.g },
      { slug: 'potato', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'beans', quantity: 200, unit: UnitOfMeasure.g },
      { slug: 'olive-oil', quantity: 2, unit: UnitOfMeasure.tbsp },
    ],
  },
];
