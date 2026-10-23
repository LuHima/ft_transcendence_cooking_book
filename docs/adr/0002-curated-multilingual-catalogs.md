# 2. Curated Multilingual Catalogs for Ingredients and Tags

We decided to use closed, predefined catalogs for ingredients and tags with relational translation tables (`IngredientTranslation`, `TagTranslation`) and canonical slugs, preventing freeform user-created names and supporting migration-free language expansion.

## Context
Allowing users to type arbitrary ingredient names or tags results in duplicate synonyms, casing issues (e.g. "tomato", "Tomatoes", "pomodoro"), and prevents consistent recipe searching by ingredient and dietary filter. Furthermore, storing translations in flat columns (`name_it`, `name_en`, `name_fr`) breaks scalability when adding new languages in the future.

## Decision
1. Ingredients and Tags are managed in curated tables with canonical `slug` identifiers.
2. Localized names are normalized into dedicated relational tables (`IngredientTranslation` and `TagTranslation`) keyed by `(entity_id, locale)`.
3. Ingredients are classified into 9 standardized culinary categories.
4. Recipe creation references existing curated ingredient and tag IDs only.
5. Ingredient preparation notes on recipes use a JSON dictionary (`notes: Json?`) keyed by locale.

## Consequences
- 100% architectural consistency: all localized entities (`Recipe`, `RecipeStep`, `Ingredient`, `Tag`) follow the relational translation pattern.
- Zero schema migrations when adding a 4th, 5th, or Nth language anywhere in the application.
- Queries can select translations for the requested locale with automatic fallback to English and slug.
