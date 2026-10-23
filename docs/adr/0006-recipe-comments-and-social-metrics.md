# 6. Recipe Comments, Social Metrics, and Author Catalog Filtering

We decided to structure recipe comments as a nested resource with 2-level threading and non-destructive deactivation, while exposing social engagement counters and author catalog filters.

## Context
Recipes are the central social entity in the platform. Users need to comment on recipes and reply to others, while recipe authors need to curate discussions under their dishes. However, deleting comments permanently would erase audit trails required for user moderation (e.g. banning abusive users) and sever conversation thread continuity for existing replies.
Additionally, while users could like recipes, the recipe APIs lacked aggregate engagement indicators (`likes_count`, `comments_count`) and a context-aware `is_liked` status, preventing frontends from knowing how to render like counts or toggle the active heart state. Furthermore, users had no dedicated API to view "My Recipes" or filter recipes by dining course, difficulty, dietary tags, or prep/cook time.

## Decision
1. **Nested Comments Resource**:
   - `POST /api/recipes/:id/comments`: Adds a new comment or reply (with `content: string` and optional `parent_id: number`).
   - `GET /api/recipes/:id/comments`: Returns comments structured in a 2-level hierarchy (root comments with nested `replies: []` array).
   - `DELETE /api/recipes/:id/comments/:commentId`: Deactivates the specified comment.
2. **Non-Destructive Deactivation (`is_active = false`)**:
   - Deleting a comment does not remove the database record; instead, `is_active` is set to `false`.
   - Authorized to both the comment author and the recipe author (for recipe discussion moderation).
   - Inactive comments are omitted from the frontend display unless they have active replies, in which case `content` and `user` are set to `null` so the frontend can display its own localized placeholder (e.g. `"[Commento eliminato]"` in IT, `"[Deleted comment]"` in EN, `"[Commentaire supprimé]"` in FR).
3. **2-Level Threading Invariant**:
   - Comments either have `parent_id = null` (root comment) or reference a root comment. Replies to replies are normalized to the root comment ID to avoid unbounded recursive nesting.
4. **Social Metrics & Context-Aware State**:
   - `GET /api/recipes/:id` and recipe listings provide `likes_count` and `comments_count`.
   - When an authenticated session is present (via JWT cookie), `is_liked: boolean` indicates whether the current user has liked the recipe; for unauthenticated requests, it defaults to `false`.
5. **Author Cookbook & Multi-Criteria Filtering**:
   - `GET /api/users/me/recipes`: Dedicated endpoint for the authenticated user to retrieve their authored recipes.
   - `GET /api/recipes`: Supports optional query filters for `author_id`, `course`, `difficulty`, `tag_ids`, `max_time`, `search`, and `lang`.

## Consequences
- Moderation records and evidence of misbehavior are preserved even if an offending user deletes their comment.
- Discussions maintain conversation structure without UI degradation from deeply nested replies.
- Frontend recipe cards can accurately reflect like/comment counts and user like states in real time.
- Users can effortlessly browse their own creations and perform targeted discovery based on course, dietary constraints, and preparation time.
