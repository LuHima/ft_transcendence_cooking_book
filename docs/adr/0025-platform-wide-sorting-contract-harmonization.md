# 0025: Platform-Wide Sorting Contract Harmonization (sort_by and sort_order)

We decided to establish a unified platform-wide sorting convention across all collection endpoints by replacing monolithic sorting enums with decoupled `sort_by` and `sort_order` parameters in `GET /api/users`, `GET /api/admin/users`, and `GET /api/admin/comments`, and enabling sorting on user cookbook recipe listings (`GET /api/users/:id/recipes` and `GET /api/users/me/recipes`).

## Context

1. **Sorting Fragmentation**: Following [ADR-0024](./0024-advanced-recipe-search-and-sorting-contract.md) which introduced decoupled `sort_by` and `sort_order` on `GET /api/recipes`, a codebase audit revealed that other endpoints were fragmented:
   - `GET /api/users` and `GET /api/admin/users` used the monolithic enum `UserSort` (`username_asc`, `username_desc`, `recipes_count_desc`, `newest`, `oldest`).
   - `GET /api/admin/comments` used the monolithic enum `AdminCommentSort` (`newest`, `oldest`, `recipe`, `reports_desc`).
   - `GET /api/users/:id/recipes` and `GET /api/users/me/recipes` lacked sorting controls, statically hardcoding `created_at desc`.
2. **REST Consistency & DX**: Having different sorting conventions across routes increases frontend cognitive overhead, complicates shared table sorting hooks, and generates fragmented OpenAPI documentation.
3. **Alpha Lifecycle Context**: Because WeCook is in active alpha development without external third-party API clients, maintaining backwards-compatibility translation shims for legacy enums would accumulate dead code and schema bloat. A clean replacement is preferred.

## Decision

1. **User Discovery Endpoints (`GET /api/users` and `GET /api/admin/users`)**:
   - Replace `sort?: UserSort` with:
     - `sort_by?: 'username' | 'recipes_count' | 'created_at'`
     - `sort_order?: 'asc' | 'desc'`
   - Contextual defaults:
     - When `search` is provided: default to `sort_by: 'username'`, `sort_order: 'asc'`.
     - When `search` is omitted in `GET /api/users`: default to `sort_by: 'recipes_count'`, `sort_order: 'desc'`.
     - When `search` is omitted in `GET /api/admin/users`: default to `sort_by: 'created_at'`, `sort_order: 'desc'`.
     - When `sort_by: 'created_at'` is specified: default `sort_order: 'desc'`.

2. **Comment Audit Stream (`GET /api/admin/comments`)**:
   - Replace `sort?: AdminCommentSort` with:
     - `sort_by?: 'created_at' | 'recipe' | 'reports_count'` (default: `'created_at'`)
     - `sort_order?: 'asc' | 'desc'` (default: `desc` for `'created_at'` and `'reports_count'`, `asc` for `'recipe'`)

3. **User Cookbook Listings (`GET /api/users/:id/recipes` and `GET /api/users/me/recipes`)**:
   - Extend `UserCookbookQueryDto` with `sort_by` and `sort_order` using the identical domain enum and defaults as `GET /api/recipes` (`created_at`, `total_time`, `difficulty`, `likes_count`, `title`).
   - Delegate sorting resolution to `RecipeService` ordering logic.

4. **Clean Replacement & Enum Removal**:
   - Completely remove `UserSort` and `AdminCommentSort` enums from the codebase.
   - Update backend controller and service tests to test `sort_by` and `sort_order`.
   - Leave frontend adjustments to separate frontend backlog tickets.

## Consequences

- **Platform Uniformity**: Every collection and search endpoint on WeCook now speaks the exact same sorting vocabulary (`sort_by` + `sort_order`).
- **Clean Contracts**: Eliminates legacy enum parameters, keeping TypeScript types and Swagger OpenAPI definitions sharp and minimal.
- **Frontend Tracking**: Changes are coordinated with the frontend team via dedicated tracking tickets without breaking ongoing work.
