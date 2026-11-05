# 0026: Recipe Comments Threaded Pagination and Windowed Replies Harmonization

We decided to harmonize the public recipe comments endpoint (`GET /api/recipes/:id/comments`) with the administrative threaded audit stream (`GET /api/admin/comments?format=threaded`) by returning a standard paginated envelope (`PaginatedRecipeCommentsResponseDto`), windowing embedded child replies to the first 5 chronological entries (`replies_limit`), tracking total reply volume (`replies_count`, `has_more_replies`), supporting decoupled activity-aware sorting (`sort_by` and `sort_order`), and standardizing embedded replies in both endpoints to chronological order (`created_at: asc`).

## Context

1. **Incoherent Discussion Architecture**:
   Previously, public recipe comments (`GET /api/recipes/:id/comments`) and administrative moderation comments (`GET /api/admin/comments?format=threaded`) behaved inconsistently:
   - `GET /api/recipes/:id/comments` returned an unbounded, unpaginated raw array (`ThreadedRecipeCommentResponseDto[]`) dumping the entire root tree and embedding all replies without pagination, leading to response payload ballooning and performance degradation on popular recipes.
   - `GET /api/admin/comments?format=threaded` returned a structured pagination envelope (`PaginatedAdminCommentsResponseDto`) with windowed replies, `replies_count`, and `has_more_replies`, allowing lazy pagination via the sub-resource `GET /api/recipes/:id/comments/:commentId/replies`.
2. **Reply Chronology Inconsistency**:
   While the dedicated reply expansion endpoint `GET /api/recipes/:id/comments/:commentId/replies` returned replies in chronological order (`created_at: asc`), `GET /api/admin/comments?format=threaded` embedded the 5 most recent replies (`created_at: desc`), disrupting the conversational reading flow for moderators and staff.
3. **Sorting Invariants**:
   Under [ADR-0024](./0024-advanced-recipe-search-and-sorting-contract.md) and [ADR-0025](./0025-platform-wide-sorting-contract-harmonization.md), all platform collection endpoints speak a unified sorting contract using decoupled `sort_by` and `sort_order`. The public comment endpoint lacked query parameters altogether, hardcoding `created_at: asc`.
4. **Privacy & Redaction Integrity**:
   Public recipe comments enforce non-destructive deactivation ([ADR-0006](./0006-recipe-comments-and-social-metrics.md)), scrubbing deleted comments with active replies to `{ content: null, user: null }` while pruning trailing/orphaned deactivated records. This visibility calculation must accurately determine pagination totals without leaking redacted comments or returning empty pages.

## Decision

1. **Clean Pagination Contract Replacement (`GET /api/recipes/:id/comments`)**:
   - Cleanly replace the bare array response with `PaginatedRecipeCommentsResponseDto`:
     - `items`: Array of `ThreadedRecipeCommentResponseDto` (root comments with windowed replies).
     - `total`: Total count of visible root comment threads for the recipe.
     - `page`: Current page number (min 1, default 1).
     - `limit`: Page size (min 1, max 100, default 20).
     - `total_pages`: Total number of pages.
     - `has_next_page`: Boolean indicating whether more root comment pages exist.
     - `has_prev_page`: Boolean indicating whether a previous root comment page exists.
   - Each root comment item embeds:
     - `replies`: Array of up to `replies_limit` child replies.
     - `replies_count`: Total count of child replies belonging to the thread.
     - `has_more_replies`: Boolean flag (`replies_count > replies.length`), indicating when the client should call `GET /api/recipes/:id/comments/:commentId/replies?page=2` to load more replies.

2. **Query Parameters (`RecipeCommentQueryDto`)**:
   - `page`: Optional integer (min 1, default 1).
   - `limit`: Optional integer (min 1, max 100, default 20).
   - `replies_limit`: Optional integer (min 1, max 20, default 5).
   - `sort_by`: Optional enum (`latest_activity` | `created_at`, default `latest_activity`).
   - `sort_order`: Optional enum (`asc` | `desc`, default `desc`).
   - Root comments sorted by `latest_activity` evaluate `Math.max(root.created_at, max(replies.created_at))` so new replies bump active threads to the top.

3. **Standardized Chronological Reply Windowing**:
   - Both `GET /api/recipes/:id/comments` and `GET /api/admin/comments?format=threaded` order embedded preview replies chronologically (`created_at: asc`).
   - The first `replies_limit` replies (default 5) are returned, ensuring a natural reading order matching the first page of the dedicated sub-resource `GET /api/recipes/:id/comments/:commentId/replies`.

4. **Lifecycle Visibility & Staff Inspection**:
   - Pruned inactive root comments (inactive with zero active replies) do not count towards `total`. Inactive root comments with active replies count towards `total` and are redacted for public callers.
   - Adopt `@UseGuards(OptionalAuthGuard)` on `GET /api/recipes/:id/comments`:
     - Staff callers (`admin`, `moderator`) see authentic comment text and user metadata for deactivated comments.
     - Public and regular community callers receive sanitized placeholders (`{ content: null, user: null, user_id: null, is_active: false }`).

## Consequences

- **Architectural Coherence**: Public and administrative comment threads follow identical pagination, reply windowing, and expansion mechanisms.
- **Payload & Memory Efficiency**: Endpoints no longer return unbounded trees for heavily commented recipes, preventing latency spikes and memory exhaustion.
- **Consistent UX**: Comments and replies read chronologically from the start of discussions, and thread expansions via the sub-resource line up seamlessly.
- **Breaking Contract for Alpha Frontend**: Frontend components (`Comments.tsx`) and TypeScript model definitions must be updated to unpack `PaginatedRecipeCommentsResponseDto` and leverage windowed reply indicators.
