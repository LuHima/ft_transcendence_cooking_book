# 0012: User Profiles, Culinary Metrics, and Authored Recipes

We decided to enrich public user profiles with culinary and social metrics, introduce handle-based lookup (`GET /api/users/by-username/:username`), add a dedicated sub-resource for authored recipes (`GET /api/users/:id/recipes`), add an optional culinary bio field, and enforce strict 404 shielding for non-active accounts.

## Context

1. **Sparse Public Profiles**: Public profiles previously returned only `id`, `username`, `avatar_url`, and `created_at`. Visitors and friends could not gauge a cook's experience, community standing, or published catalog (`recipes_count`, `friends_count`, `total_likes_received`).
2. **Missing Culinary Biography**: The user model lacked any biography field, preventing cooks from sharing their culinary background, specialty dishes, or cooking philosophy.
3. **Handle Discovery Ergonomics**: In social networks, sharing and navigating to user profiles via `@username` handles is standard. Previously, profile lookup was restricted to internal database integer IDs (`GET /api/users/:id`).
4. **Sub-resource Exploration**: While authenticated users could query their own recipes via `GET /api/users/me/recipes`, browsing another member's public recipes required querying the global catalog with query parameters (`GET /api/recipes?author_id=:id`), violating REST sub-resource hierarchy conventions.
5. **Account Status Leaks**: Inactive, suspended, banned, or soft-deleted accounts could be partially retrieved by ID, failing to protect user privacy and system security.

## Decision

1. **Database Schema Update**:
   - Add `bio String? @db.VarChar(500)` to `model User` in `schema.prisma`.
   - Migration adds `bio` as a nullable column for zero-downtime backward compatibility.
   - Update `UpdateUserDto` to allow optional bio editing (`@MaxLength(500)`).
   - Expose `bio: string | null` in `UserProfileResponseDto` (`GET /api/users/me`) and `PublicUserResponseDto`.
2. **Enriched Public Profile (`PublicUserResponseDto`)**:
   - Return: `id`, `username`, `first_name`, `last_name`, `avatar_url`, `bio`, `created_at`.
   - Aggregated metrics computed on-the-fly via indexed queries:
     - `recipes_count`: `prisma.recipe.count({ where: { user_id: id } })`
     - `friends_count`: `prisma.friendship.count({ where: { status: 'accepted', OR: [{ requester_id: id }, { addressee_id: id }] } })`
     - `total_likes_received`: `prisma.like.count({ where: { recipe: { user_id: id } } })`
   - Contextual `friendship_status` (`none`, `pending_sent`, `pending_received`, `friends`) when authenticated, or `null` when anonymous.
3. **Handle-Based Profile Lookup**:
   - Expose `GET /api/users/by-username/:username`.
   - Case-insensitive lookup matching `username`.
   - Returns the identical `PublicUserResponseDto` payload as `GET /api/users/:id`.
4. **Authored Recipes Sub-Resource**:
   - Expose `GET /api/users/:id/recipes`, protected with `OptionalAuthGuard`.
   - Accepts `UserCookbookQueryDto` (`page`, `limit`, `lang`).
   - Returns paginated `LocalizedRecipeSummaryResponse` items sorted by `created_at DESC`.
   - Contextual `is_liked` flag is resolved relative to the authenticated caller (or `false` for anonymous callers).
5. **Strict Account Shielding**:
   - All public endpoints (`GET /api/users/:id`, `GET /api/users/by-username/:username`, `GET /api/users/:id/recipes`) verify `status === 'active'` and `deleted_at === null`.
   - Any access to an account that is soft-deleted, disabled, or banned returns `404 Not Found` (`User not found`).

## Consequences

- Fully supports member discovery, culinary profiles, and authored recipe exploration.
- Preserves REST architectural principles by maintaining numeric ID canonical sub-resources while offering handle resolution.
- Enforces data privacy and anti-enumeration invariants across all member-facing endpoints.
