# 0018: Unified Recipe Projections, Shared Query Contracts, and Query-Projection Decoupling

We decided to decouple database query execution from localized DTO projection by introducing an authoritative, stateless `RecipeProjection` service with shared typed Prisma inclusion contracts (`RECIPE_SUMMARY_INCLUDE`, `RECIPE_DETAIL_INCLUDE`), standardizing multi-tier translation cascades, tag localization, ingredient note resolution, and pagination envelope assembly across catalog search, personal cookbooks, and social activity feeds.

## Context

1. **Projection Duplication Across Domains**: Recipe summary cards (`LocalizedRecipeSummaryResponse`) and pagination envelopes (`PaginatedRecipeResponseDto`) are retrieved across three distinct modules:
   - `RecipeService.getAllRecipe`: catalog browsing and multi-criteria faceted search.
   - `UsersService`: `getLikedRecipes` (saved cookbook), `getMyRecipes` (private authored recipes), and `getUserPublicRecipes` (public author profiles).
   - `FeedService.getFeed`: chronologically ordered social activity feed of recipes from confirmed friends.
2. **Triplicated Localization & Mapping Boilerplate**: Each service independently maintained its own copy of:
   - The complex Prisma `include` configuration (joining `translations`, `user` profile cards, dietary `tags` and `tag_translations`, and `_count` of active comments and likes).
   - Multi-tier translation resolution loops (`requestedLocale -> source_lang -> 'en' -> first available`).
   - Dietary tag localization with fallbacks to English and canonical slugs.
   - Bounded pagination envelope math (`total_pages`, `has_next_page`, `has_prev_page`).
   Over 550 lines of duplicate mapping code existed across these services.
3. **High Risk of Contract Drift & Inconsistent UX**: Modifying the recipe card structure or adding supported locales required synchronized edits across 5 disparate methods. Inconsistencies risked leaking into the frontend (e.g. subtle differences in tag formatting or comment count filtering).
4. **Architectural Trade-Off**: Introducing a monolithic query-executing repository would force disparate domain concepts (`Friendship`, `UserBlock`, `Like`, catalog search) into an unwieldy god-query. Conversely, keeping mapping in each service perpetuated duplication.

## Decision

1. **Stateless `RecipeProjection` Service**:
   - Create `@Injectable() class RecipeProjection` in `src/backend/src/recipe/recipe.projection.ts`.
   - Export and register `RecipeProjection` in `RecipeModule`.
   - Import `RecipeModule` into `UsersModule` and `FeedModule`.
2. **Decoupled In-Memory Transformation Seam**:
   - Calling services retain complete autonomy over their domain queries (filtering by friendships, likes, or search parameters).
   - Once database records are fetched, callers pass the raw entities and query parameters to `RecipeProjection`.
3. **Shared Typed Query Contracts**:
   - `RECIPE_SUMMARY_INCLUDE(currentUserId?: number)`: Standardized Prisma inclusion graph for summary cards.
   - `RECIPE_DETAIL_INCLUDE(currentUserId?: number)`: Standardized Prisma inclusion graph for full recipe detail views.
4. **High-Leverage Transformation Methods**:
   - `toLocalizedSummary(recipe, lang, currentUserId)`: Transforms a single raw record into `LocalizedRecipeSummaryResponse`.
   - `toPaginatedSummaryResponse(recipes, total, paginationQuery, currentUserId)`: Transforms an array of recipe records and wraps them in a fully computed `PaginatedRecipeResponseDto` envelope.
   - `toLocalizedDetail(recipe, lang, currentUserId)`: Transforms a full recipe record with ordered steps, localized ingredients, notes, and media into `LocalizedRecipeDetailResponse`.
5. **Deterministic Multi-Tier Fallback Invariants**:
   - Recipe metadata: `targetLocale -> source_lang -> 'en' -> translations[0]`.
   - Dietary tags: `targetLocale -> source_lang -> 'en' -> tag.slug`.
   - Ingredient preparation notes: Graceful cascade across JSON dictionary keys (`Record<string, string>`) with backwards-compatible string note fallback.
   - Social engagement: Dynamic `is_liked` calculation based on the viewer's authenticated ID.

## Consequences

- **100% Schema Parity**: All recipe lists across search, profiles, cookbooks, and friends' feeds produce identical card structures and localization fallbacks.
- **Locality & Code Elimination**: Eliminates over 500 lines of duplicate transformation boilerplate across `RecipeService`, `UsersService`, and `FeedService`.
- **Pure Unit Testability**: All translation cascades, tag mappings, and pagination math are verified via pure, fast unit tests without database mocks.
- **Zero Query Overhead**: Services fetch exactly what they need without introducing N+1 queries or complex join abstractions.
