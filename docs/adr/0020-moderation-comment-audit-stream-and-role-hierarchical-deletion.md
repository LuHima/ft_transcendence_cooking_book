# 0020: Moderation Comment Audit Stream and Hierarchical Deletion Rules

We decided to implement a flat, chronological comment audit stream (`GET /api/admin/comments`) accessible to both administrators and moderators, and extend comment deactivation (`DELETE /api/recipes/:recipeId/comments/:id`) with role hierarchy enforcement (preventing moderators from deactivating comments authored by administrators).

## Context

1. **Moderation Need**: In a culinary social network, toxic, abusive, or spam comments may appear as top-level remarks or as nested replies to older recipes. Moderators need a centralized audit stream to inspect and triage recent comments across the entire platform.
2. **Threaded vs Flat Pagination Trade-off**: While public recipe pages present comments in a nested tree (`GET /api/recipes/:id/comments`), paginating by parent threads in an audit stream would bury newly posted abusive replies under older discussions.
3. **Role Hierarchy Invariant**: Standard users can only delete their own comments or comments posted on recipes they authored. Platform staff need deletion authority across all recipes. However, allowing a moderator to delete an administrator's comment would violate the platform's authority hierarchy.

## Decision

1. **Flat Chronological Audit Stream (`GET /api/admin/comments`)**:
   - Query filters: `page` (default 1), `limit` (default 20, max 100), `search` (case-insensitive search in `content`), `status` (`active`, `inactive`, `all`, default `all`), `recipe_id` (optional), `user_id` (optional), `lang` (optional locale).
   - In a moderation stream, **every comment and reply is treated as an individual atomic item** ordered by `created_at desc`. Each comment counts as 1 item towards the `limit`.
   - Returns the standard pagination envelope (`items`, `total`, `page`, `limit`, `total_pages`, `has_next_page`, `has_prev_page`).
   - Each item includes `id`, `content`, `is_active`, `is_edited`, `created_at`, `parent_id`, hydrated author (`id`, `username`, `avatar_url`), and hydrated recipe (`id`, localized `title` based on requested `lang` with fallback to `source_lang` and first available translation).

2. **Role Hierarchy for Deletion (`DELETE /api/recipes/:recipeId/comments/:id`)**:
   - **Administrators**: Can deactivate (`is_active = false`) any comment on any recipe.
   - **Moderators**: Can deactivate any comment on any recipe **unless** the author is an `admin` (returns `403 Forbidden` with `errors.common.forbidden`).
   - **Regular Users**: Can only deactivate their own comments or comments on their own authored recipes.
   - **Soft Deactivation & Notification Pruning**: Preserves thread continuity by keeping the comment row (`is_active = false`) and removes pending unread reply notifications targeting the deactivated comment.

## Consequences

- Equips platform moderators and administrators with global visibility into community discussions.
- Guarantees immediate surfacing of newly posted replies in the audit stream, preventing moderation blind spots.
- Enforces role hierarchy integrity across all comment deletion operations.
- Matches Margherita's frontend [AdminComments.tsx](file:///home/daromoli/Documents/42-transcendence/src/frontend/src/pages/admin/AdminComments.tsx) contract.
