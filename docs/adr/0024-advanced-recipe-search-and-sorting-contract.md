# 0024: Advanced Multi-Criteria Recipe Search, Boolean Filter Semantics, and Harmonized Sorting Contract

We decided to upgrade `GET /api/recipes` with multi-criteria filtering (duration ranges, original authoring language, translation provenance curation, pantry ingredient inclusion/exclusion, and tag matching modes), standardize platform sorting via decoupled `sort_by` and `sort_order` query parameters, and resolve localized title ordering via two-step ID retrieval with Prisma relation hydration.

## Context

1. **Catalog Search Gaps**: `FilterRecipeDto` previously lacked support for duration minimums (`min_time`), low-effort preparation thresholds (`max_prep_time`), author source language discovery (`source_lang`), pantry ingredient matching (`ingredient_ids`, `exclude_ingredient_ids`), and dietary tag conjunction modes (`tag_mode`, `exclude_tag_ids`).
2. **Translation Quality & Curation**: With automated translation via LibreTranslate ([ADR-0004](./0004-relational-multilingual-translations-and-libretranslate.md), [ADR-0022](./0022-recipe-translation-provenance-and-editorial-tracking.md)), users requested the ability to browse recipes written directly in their language or manually curated by humans, avoiding unverified machine translations.
3. **Boolean Filter Mechanics**: While full arbitrary AST expressions (with nested AND/OR/XOR/NOT) in URL query strings introduce severe validation overhead and awkward client semantics, culinary discovery fundamentally requires two specific boolean behaviors: conjunction vs disjunction on multi-value attributes (`tag_mode`, `ingredient_mode` defaulting to `all`), and explicit exclusion sets (`exclude_tag_ids`, `exclude_ingredient_ids`).
4. **Sorting Standardization**: `GET /api/recipes` previously hardcoded `orderBy: { created_at: 'desc' }`, whereas `GET /api/users` used a monolithic enum (`UserSort`). A decoupled sorting pattern (`sort_by` + `sort_order`) provides better API scalability.
5. **Prisma Relational Ordering Constraint**: Titles reside in the localized `RecipeTranslation` table (1-to-many relation). Prisma's `findMany` does not support ordering by fields of 1-to-many relations, necessitating custom SQL ordering when sorting alphabetically.

## Decision

1. **Duration Boundaries**:
   - `min_time?: number` (`total_time >= min_time`)
   - `max_time?: number` (`total_time <= max_time`)
   - `max_prep_time?: number` (`prep_time <= max_prep_time`)

2. **Language and Translation Curation**:
   - `source_lang?: string`: Filters by original recipe authoring locale (`recipe.source_lang`).
   - `curated_only?: boolean`: When `true`, requires `lang` to be explicitly provided (returns `400 Bad Request` if omitted). Filters recipes where the translation for `lang` has `translation_source IN ('author_original', 'manual')`.

3. **Multi-Value Modes and Exclusions**:
   - `tag_ids?: number[]` with `tag_mode?: 'all' | 'any'` (default: `'all'`).
   - `exclude_tag_ids?: number[]`.
   - `ingredient_ids?: number[]` with `ingredient_mode?: 'all' | 'any'` (default: `'all'`).
   - `exclude_ingredient_ids?: number[]`.
   - Strict validation: `FilterRecipeDto` rejects with `400 Bad Request` if `tag_ids` intersects `exclude_tag_ids` or `ingredient_ids` intersects `exclude_ingredient_ids`.

4. **Harmonized Sorting Contract**:
   - `sort_by?: 'created_at' | 'total_time' | 'difficulty' | 'likes_count' | 'title'` (default: `'created_at'`).
   - `sort_order?: 'asc' | 'desc'` (default: `desc` for `created_at` and `likes_count`; `asc` for `total_time`, `difficulty`, and `title`).
   - Log technical debt to migrate `GET /api/users` from monolithic `UserSort` to decoupled `sort_by` / `sort_order` in a subsequent refactor.

5. **Two-Step Query Execution for Localized Title Ordering**:
   - When `sort_by !== 'title'`: Execute standard `prisma.recipe.findMany` with native Prisma `where` criteria and `orderBy` clauses (using `likes: { _count: sort_order }` for likes).
   - When `sort_by === 'title'`:
     1. Execute a lightweight SQL `$queryRaw` query joining `recipe_translations` with locale fallback `COALESCE(target.title, source.title, en.title)` to retrieve paginated IDs (`SELECT r.id FROM recipes ... ORDER BY resolved_title LIMIT :limit OFFSET :offset`).
     2. Hydrate complete recipe entities and relations via Prisma `findMany({ where: { id: { in: ids } }, include: RECIPE_SUMMARY_INCLUDE })`, preserving the sorted order.

## Consequences

- **Expressive Querying**: Enables pantry search ("recipes containing tomato AND basil without dairy"), quick prep filters, and curation discovery.
- **Contract Robustness**: Validates input conflicts at the DTO layer and maintains accurate Swagger / OpenAPI schema definitions.
- **Architectural Decoupling**: Preserves `RecipeProjection` and relational includes without duplicating SQL projection logic for title sorting.
- **Frontend Alignment**: Backlog ticket created for the frontend to expose a match-mode toggle between "all" and "any" tags.
