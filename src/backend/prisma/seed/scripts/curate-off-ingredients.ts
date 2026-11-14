import * as fs from 'fs';
import * as path from 'path';
import { IngredientCategory } from '@prisma/client';
import type { CatalogIngredientSeed } from '../seeders/catalog.seeder';

export interface OffTaxonomyEntry {
  name?: Record<string, string>;
  parents?: string[];
  ecobalyse_category?: { en?: string };
  mandatory_additive_class?: { en?: string };
  e_number?: { en?: string };
}

const E_NUMBER_REGEX = /^(?:en:)?e[-\s]?\d{3,4}[a-z]?$/i;
const GARBAGE_NAME_REGEX = /(?:^[a-z]{2}:|https?:\/\/|[[\]{}<>]|^\d+$|\?\?)/i;

const INDUSTRIAL_KEYWORDS = [
  'additive',
  'emulsifier',
  'stabilizer',
  'stabiliser',
  'preservative',
  'antioxidant',
  'thickener',
  'acidity regulator',
  'colorant',
  'colourant',
  'humectant',
  'anti-caking',
  'anticaking',
  'glazing agent',
  'raising agent',
  'firming agent',
  'bulking agent',
  'sequestrant',
  'propellant',
  'processing aid',
  'flavor enhancer',
  'flavour enhancer',
  'sweetener',
  'modified starch',
  'mono- and diglycerides',
  'diglycerides',
  'polyglycerol',
  'carboxymethyl',
  'carrageenan',
  'xanthan',
  'maltodextrin',
  'aspartame',
  'acesulfame',
  'sucralose',
  'saccharin',
  'benzoate',
  'sorbate',
  'metabisulfite',
  'metabisulphite',
  'polyphosphate',
  'triphosphate',
  'diphosphate',
  'polysorbate',
  'flavouring',
  'flavoring',
  'pectin',
  'from concentrate',
  'from-concentrate',
  'dextrose',
  'glucose syrup',
  'glucose-syrup',
  'invert sugar',
  'caseinate',
  'hydrolysate',
  'protein isolate',
  'whey powder',
  'apple fiber',
  'apple fibre',
  'citrus fiber',
  'citrus fibre',
  'bamboo fiber',
  'pea fiber',
  'oat fiber',
];

/**
 * Normalizes an arbitrary string into a deterministic ASCII slug (`a-z0-9-`).
 */
export function normalizeSlug(raw: string): string {
  const withoutPrefix = raw.replace(/^[a-z]{2}:/i, '');
  const ascii = withoutPrefix
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return ascii.slice(0, 100).replace(/-+$/g, '');
}

/**
 * Validates that an entry has clean, non-empty `it`, `en`, and `fr` names
 * within the 100-character database column limit.
 */
export function hasValidMultilingualNames(
  names?: Record<string, string>,
): names is { it: string; en: string; fr: string } {
  if (!names) return false;
  for (const locale of ['it', 'en', 'fr'] as const) {
    const val = names[locale]?.trim();
    if (!val || val.length < 2 || val.length > 100) return false;
    if (GARBAGE_NAME_REGEX.test(val)) return false;
  }
  return true;
}

/**
 * Returns true if the taxonomy entry represents a food additive, E-number,
 * processing aid, or non-culinary industrial chemical.
 */
export function isAdditiveOrIndustrial(
  key: string,
  entry: OffTaxonomyEntry,
  names: { it: string; en: string; fr: string },
): boolean {
  if (entry.mandatory_additive_class?.en || entry.e_number?.en) {
    return true;
  }
  const keySlug = key.replace(/^[a-z]{2}:/i, '');
  if (E_NUMBER_REGEX.test(keySlug) || E_NUMBER_REGEX.test(names.en)) {
    return true;
  }

  const parents = entry.parents ?? [];
  if (
    parents.some(
      (p) =>
        p.includes('additive') ||
        p.includes('e-number') ||
        p.includes('emulsifier') ||
        p.includes('stabilizer') ||
        p.includes('preservative') ||
        p.includes('colour') ||
        p.includes('sweetener'),
    )
  ) {
    return true;
  }

  const combined =
    `${keySlug} ${names.en} ${names.it} ${names.fr}`.toLowerCase();
  return INDUSTRIAL_KEYWORDS.some((kw) => combined.includes(kw));
}

function collectAncestors(
  key: string,
  taxonomy: Record<string, OffTaxonomyEntry>,
  maxDepth = 5,
): string[] {
  const visited = new Set<string>();
  const queue: Array<{ k: string; depth: number }> = [{ k: key, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    const parents = taxonomy[current.k]?.parents ?? [];
    for (const p of parents) {
      if (!visited.has(p)) {
        visited.add(p);
        queue.push({ k: p, depth: current.depth + 1 });
      }
    }
  }
  return Array.from(visited);
}

/**
 * Maps an Open Food Facts entry to one of the 9 `IngredientCategory` enum values.
 */
export function mapOffCategory(
  key: string,
  entry: OffTaxonomyEntry,
  names: { it: string; en: string; fr: string },
  ancestors: string[] = [],
): IngredientCategory {
  const eco = entry.ecobalyse_category?.en?.toLowerCase() ?? '';
  const allSignals = [
    key.toLowerCase(),
    eco,
    ...ancestors.map((a) => a.toLowerCase()),
    names.en.toLowerCase(),
  ].join(' ');

  if (
    eco === 'dairy' ||
    /\b(milk|cheese|yogurt|butter|cream|egg|eggs|mozzarella|parmesan|ricotta|whey|casein|curd|ghee|kefir)\b/.test(
      allSignals,
    )
  ) {
    return IngredientCategory.dairy_eggs;
  }
  if (
    /\b(fish|salmon|tuna|cod|shrimp|prawn|crab|lobster|mussel|clam|oyster|squid|octopus|anchovy|sardine|trout|seafood|shellfish|mollusc|crustacean)\b/.test(
      allSignals,
    )
  ) {
    return IngredientCategory.seafood;
  }
  if (
    /\b(meat|beef|pork|chicken|turkey|duck|lamb|veal|bacon|ham|sausage|prosciutto|salami|poultry|venison|rabbit)\b/.test(
      allSignals,
    )
  ) {
    return IngredientCategory.meat_poultry;
  }
  if (
    /\b(legume|bean|lentil|chickpea|pea|soy|tofu|tempeh|nut|almond|walnut|hazelnut|pistachio|cashew|pecan|peanut|chestnut|pine-nut|seed|sesame|sunflower|pumpkin-seed|chia|flax)\b/.test(
      allSignals,
    )
  ) {
    return IngredientCategory.legumes_nuts;
  }
  if (
    /\b(flour|bread|pasta|rice|wheat|oat|barley|rye|cornmeal|semolina|couscous|quinoa|noodle|cereal|grain|yeast|dough|pastry|biscuit|cracker|spaghetti|macaroni)\b/.test(
      allSignals,
    )
  ) {
    return IngredientCategory.bakery_grains;
  }
  if (
    /\b(water|juice|wine|beer|coffee|tea|broth|stock|vinegar|milk-substitute|soy-milk|oat-milk|almond-milk|beverage|drink|liquor|rum|brandy|liqueur|cider)\b/.test(
      allSignals,
    )
  ) {
    return IngredientCategory.beverages_liquids;
  }
  if (
    /\b(spice|herb|pepper|salt|sugar|honey|oil|olive-oil|mustard|sauce|syrup|chocolate|cocoa|vanilla|cinnamon|paprika|cumin|curry|oregano|thyme|sage|turmeric|ginger|nutmeg|clove|cardamom|saffron|condiment|seasoning)\b/.test(
      allSignals,
    )
  ) {
    return IngredientCategory.pantry_spices;
  }
  if (
    eco === 'fruits_and_vegetables' ||
    /\b(fruit|vegetable|tomato|potato|onion|garlic|carrot|apple|banana|orange|lemon|lime|berry|strawberry|grape|pepper|spinach|lettuce|cabbage|broccoli|zucchini|eggplant|mushroom|avocado|pear|peach|plum|cherry|melon)\b/.test(
      allSignals,
    )
  ) {
    return IngredientCategory.produce;
  }

  return IngredientCategory.other;
}

function formatDisplayName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Curates ~`targetCount` multilingual culinary ingredients from an Open Food Facts
 * taxonomy object, preserving all baseline ingredients and avoiding slug collisions.
 */
export function curateOpenFoodFactsIngredients(
  rawTaxonomy: Record<string, OffTaxonomyEntry>,
  baseline: CatalogIngredientSeed[],
  targetCount = 3000,
): CatalogIngredientSeed[] {
  const result: CatalogIngredientSeed[] = [...baseline];
  const seenSlugs = new Set<string>(baseline.map((b) => b.slug));
  const seenEnglishNames = new Set<string>(
    baseline.map((b) => b.translations.en.trim().toLowerCase()),
  );

  // Prefer entries with `en:` keys first for clean canonical slugs
  const keys = Object.keys(rawTaxonomy).sort((a, b) => {
    const aEn = a.startsWith('en:') ? 0 : 1;
    const bEn = b.startsWith('en:') ? 0 : 1;
    if (aEn !== bEn) return aEn - bEn;
    return a.localeCompare(b);
  });

  for (const key of keys) {
    if (result.length >= targetCount) break;
    const entry = rawTaxonomy[key];
    if (!hasValidMultilingualNames(entry?.name)) continue;

    const names = {
      it: formatDisplayName(entry.name.it),
      en: formatDisplayName(entry.name.en),
      fr: formatDisplayName(entry.name.fr),
    };

    if (isAdditiveOrIndustrial(key, entry, names)) continue;

    const slug = normalizeSlug(key) || normalizeSlug(names.en);
    if (!slug || slug.length < 2) continue;
    if (seenSlugs.has(slug)) continue;
    if (seenEnglishNames.has(names.en.toLowerCase())) continue;

    const ancestors = collectAncestors(key, rawTaxonomy);
    const category = mapOffCategory(key, entry, names, ancestors);

    seenSlugs.add(slug);
    seenEnglishNames.add(names.en.toLowerCase());
    result.push({
      slug,
      category,
      translations: names,
    });
  }

  return result;
}

if (require.main === module) {
  const inputPath =
    process.argv[2] ?? path.resolve('/tmp/off-ingredients.json');
  const outputPath =
    process.argv[3] ?? path.resolve(__dirname, '../data/ingredients.json');
  const baselinePath = path.resolve(__dirname, '../data/ingredients.json');

  const rawTaxonomy = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as Record<
    string,
    OffTaxonomyEntry
  >;
  const existing = JSON.parse(
    fs.readFileSync(baselinePath, 'utf8'),
  ) as CatalogIngredientSeed[];

  // Keep only the original 57 baseline items if re-running
  const baseline = existing.slice(0, 57);
  const curated = curateOpenFoodFactsIngredients(rawTaxonomy, baseline, 3000);
  fs.writeFileSync(outputPath, JSON.stringify(curated, null, 2) + '\n');
  console.log(
    `[curate-off] Curated ${curated.length} ingredients -> ${outputPath}`,
  );
}
