# 0032: Catalog and Ban History Pagination Contract

We decided to introduce paginated admin catalog list endpoints (`GET /api/admin/catalog/ingredients`, `GET /api/admin/catalog/tags`) and convert the three remaining unpaginated collection endpoints (`GET /api/ingredients`, `GET /api/tags`, `GET /api/admin/users/:id/ban-history`) to the platform's standard 7-field pagination envelope (`items`, `total`, `page`, `limit`, `total_pages`, `has_next_page`, `has_prev_page`) backed by `PaginationQueryDto` (`page = 1`, `limit = 20`, max `100`).

## Context

An audit of all backend `GET` collection endpoints showed 17 of 20 endpoints already paginated, leaving `GET /api/ingredients`, `GET /api/tags`, and `GET /api/admin/users/:id/ban-history` returning unbounded plain arrays, while `AdminCatalogController` (ADR 0031) had no dedicated admin list endpoints and forced `AdminCatalog.tsx` to query public catalog routes.

## Decision

1. **Public vs. Admin Catalog Separation**:
   - **Admin list endpoints** (`GET /api/admin/catalog/ingredients`, `GET /api/admin/catalog/tags`) return `IngredientDetailResponseDto` / `TagDetailResponseDto` with all three translations (`it`, `en`, `fr`) per row and support `search`, `category` (ingredients only), and DB-level sorting `sort_by: 'id' | 'slug'` (default `'id'`), `sort_order: 'asc' | 'desc'` (default `'asc'`).
   - **Public list endpoints** (`GET /api/ingredients`, `GET /api/tags`) mirror the query contract (`page`, `limit`, `search`, `category` on ingredients, `lang`) but return localized `IngredientResponseDto` / `TagResponseDto` and support `sort_by: 'slug' | 'name'` (default `'name'`), `sort_order: 'asc' | 'desc'` (default `'asc'`).
2. **Ban History Pagination**:
   - `GET /api/admin/users/:id/ban-history` accepts `PaginationQueryDto` plus optional `sort_order: 'asc' | 'desc'` (default `'desc'` on `banned_at`) and returns `PaginatedBanHistoryResponseDto`.
3. **Standard Per-Resource Envelope DTOs**:
   - All five endpoints define explicit Swagger-typed envelope classes (`PaginatedAdminIngredientsResponseDto`, `PaginatedAdminTagsResponseDto`, `PaginatedIngredientsResponseDto`, `PaginatedTagsResponseDto`, `PaginatedBanHistoryResponseDto`) matching existing platform envelopes rather than introducing a generic wrapper.

## Considered Options

- **DB-only `id | slug` sorting on public catalog endpoints**: Rejected because recipe authors and search pickers expect ingredients and tags sorted alphabetically in their active locale (`name` via `localeCompare`), even though `name` lives in translation rows and requires localized sorting before slicing when `sort_by = 'name'`.
- **Higher `max` limit (> 100) for public dropdown endpoints**: Rejected to keep strict uniformity with `PaginationQueryDto` across all 22 paginated endpoints; clients use `search` or `limit <= 100` / pagination.

## Consequences

- **Positive**: Every collection `GET` endpoint in the API is now bounded and paginated under a uniform contract; admin catalog editing receives full multilingual rows without falling back to public endpoints.
- **Negative / Trade-offs**: Converting `GET /api/ingredients`, `GET /api/tags`, and `GET /api/admin/users/:id/ban-history` from plain arrays to paginated envelopes is a breaking contract change requiring frontend updates in `AdminCatalog`, `RecipeForm`, `SearchResults`, and `AdminUsers`, as well as OpenAPI and Postman collection synchronization.
