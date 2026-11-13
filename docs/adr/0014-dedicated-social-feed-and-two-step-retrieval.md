# 0014: Dedicated Social Feed and Two-Step Retrieval

We decided to encapsulate personalized social timelines in a dedicated `FeedModule` mounted at `GET /api/feed`, using strict authentication (`@Auth()`), a two-step query strategy with zero-cost short-circuiting for users without friends, and reusing the standard `PaginatedRecipeResponseDto` contract.

## Context

1. **Missing Social Timeline**: Previously, users could only discover recipes through global catalog browsing (`GET /api/recipes`) or searching individual cooks. Mutual friendships did not provide any aggregated content stream, breaking the core value proposition of a social network.
2. **First-Class Domain Separation**: Placing the feed inside `RecipeModule` (`GET /api/recipes/feed`) or `UsersModule` (`GET /api/users/me/feed`) conflates catalog search and user account preferences with social timeline aggregation. A social activity feed is a top-level domain concept representing the user's home screen.
3. **Query Performance & Empty States**: Many users have zero friends or friends who haven't published recipes yet. Executing a heavy SQL join combining `friendships`, `users`, `recipes`, `translations`, `recipe_tags`, and `likes` on every feed request causes unnecessary database overhead for empty results.
4. **Contract Uniformity**: Frontend recipe card renderers (cover images, prep time, difficulty, like badges, localized titles) are standardized around `PaginatedRecipeResponseDto`. Creating divergent response structures for feeds increases frontend maintenance overhead.

## Decision

1. **Dedicated Module & Route**:
   - Create `FeedModule`, `FeedController`, and `FeedService` mounted at `GET /api/feed`.
   - Protect endpoint strictly with `@Auth()` (`401 Unauthorized` for anonymous requests).
2. **Lightweight Query Contract (`FeedQueryDto`)**:
   - Inherits `PaginationQueryDto` (`page?: number = 1`, `limit?: number = 20`, max 100).
   - Accepts `lang?: 'it' | 'en' | 'fr'` for localized titles and descriptions.
   - Defaults to chronological ordering (`created_at: 'desc'`).
3. **Two-Step Query Execution & Short-Circuit**:
   - **Step 1 (Friend Resolution)**: Query `friendships` table for confirmed friends (`status: 'accepted'`) where the current user is either `requester_id` or `addressee_id`.
   - **Short-Circuit**: If `friendIds.length === 0`, return `{ items: [], total: 0, page, limit, total_pages: 0, has_next_page: false, has_prev_page: false }` immediately without hitting the `recipes` table.
   - **Step 2 (Recipe Retrieval)**: If friends exist, query `recipes` where `user_id IN (friendIds)` and author `user: { status: 'active', deleted_at: null }`, ordered by `created_at DESC`.
   - Resolve contextual `is_liked` relative to the authenticated user.
4. **Standardized Response Payload**:
   - Returns `PaginatedRecipeResponseDto` containing `LocalizedRecipeSummaryResponse[]`.
   - If friends have posted 0 recipes, returns standard empty paginated collection (`items: []`, `total: 0`). The frontend distinguishes "no friends" vs "no recipes" using the user's friend count from their session.
5. **Real-Time Consistency**:
   - Unfriending a user or receiving a friend acceptance is immediately reflected on subsequent feed queries without caching delay.

## Consequences

- Delivers a clean, responsive home activity feed for connected cooks.
- Eliminates database load for users without friends via zero-cost short-circuiting.
- Reuses existing recipe summary component contracts on the frontend without custom DTO fragmentation.
