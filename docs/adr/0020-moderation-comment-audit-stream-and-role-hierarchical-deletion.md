# 0020: Moderation Comment Audit Stream and Hierarchical Deletion Rules

We decided to establish an advanced comment audit stream (`GET /api/admin/comments`) supporting flexible sorting (`newest`, `oldest`, `recipe`, `reports_desc`), dual presentation formats (`flat` atomic stream and `threaded` view with windowed reply previews), dedicated reply expansion (`GET /api/recipes/:recipeId/comments/:commentId/replies`), verbatim language preservation without automated machine translation on write, and multi-tier deletion controls enforcing role hierarchy for soft deactivation and an admin-only hard deletion safeguard requiring explicit reply pruning (`prune_replies=true`).

## Context

1. **Moderation Need**: In a culinary social network, toxic, abusive, or spam comments may appear as top-level remarks or as nested replies across thousands of platform recipes. Platform moderators and administrators need flexible triage tools to inspect recent comments, audit discussions grouped by recipe, prioritize heavily reported remarks, and examine modified comments.
2. **Threaded vs Flat Pagination & Payload Control**: While public recipe pages present nested threads (`GET /api/recipes/:id/comments`), paginating exclusively by parent threads in an audit stream buries newly posted abusive replies under older discussions. Conversely, returning unbounded child replies in a threaded view risks payload bloat, latency spikes, and memory exhaustion.
3. **Language Verbatim Integrity**: Evaluating moderation flags on machine-translated text causes false positives and false negatives due to slang, colloquialisms, and machine translation hallucinations. Community comments must be reviewed and preserved in their authentic, original text.
4. **Hierarchical Deletion & Cascading Destruction**: Standard users can only delete their own comments or comments posted on their recipes. Platform staff need deletion authority across all recipes, but allowing a moderator to delete an administrator's comment would violate authority hierarchy. Furthermore, permanent hard deletion of a parent comment with child replies must not accidentally destroy innocent discussions without explicit confirmation.

## Decision

1. **Flexible Comment Audit Stream (`GET /api/admin/comments`)**:
   - Accessible to `admin` and `moderator` roles (`@Roles('admin', 'moderator')`).
   - Query filters:
     - `page`: integer (min 1, default 1).
     - `limit`: integer (min 1, max 100, default 20).
     - `search`: case-insensitive substring search in comment content.
     - `status`: enum (`active`, `inactive`, `all`, default `all`).
     - `recipe_id`: optional integer.
     - `user_id`: optional integer.
     - `is_edited`: optional boolean (filters for modified comments).
     - `sort`: enum:
       - `newest` (default: `created_at desc` across all comments).
       - `oldest` (`created_at asc`).
       - `recipe` (`recipe_id asc, created_at desc`, grouping comments per recipe).
       - `reports_desc` (orders comments with the highest number of pending/total moderation reports first).
     - `format`: enum:
       - `flat` (default: atomic list where each comment or reply counts as 1 paginated item).
       - `threaded` (paginates root comments ordered by `latest_activity_desc`, embedding up to `replies_limit` child replies).
     - `replies_limit`: integer (default 5, max 20, applied when `format=threaded`).
   - Threaded response metadata: each root comment includes `replies_count`, `has_more_replies: boolean`, and the window of recent replies.
   - Author hydration: `id`, `username`, `avatar_url`.
   - Recipe hydration: `id`, localized `title` based on requested `lang` (fallback to `source_lang` and original title).

2. **Dedicated Reply Pagination Sub-Resource**:
   - `GET /api/recipes/:recipeId/comments/:commentId/replies`:
     - Paginates all replies of a specific parent comment (`page`, `limit`).
     - Enables frontend clients and moderators to expand long conversation threads on demand without response bloat.

3. **Verbatim Language Integrity**:
   - Comments are stored and retrieved strictly in their original author-composed text.
   - Automated machine translation via LibreTranslate is not performed on comment creation.
   - Moderation evaluation is anchored strictly to authentic source content. (On-demand client translation is deferred to a dedicated feature proposal).

4. **Multi-Tier Deletion & Cascading Safeguards**:
   - **Soft Deactivation (`DELETE /api/recipes/:recipeId/comments/:id`, default `hard=false`)**:
     - Preserves thread continuity by setting `is_active = false` and pruning unread reply notifications.
     - Role hierarchy:
       - `admin`: Can deactivate any comment on any recipe.
       - `moderator`: Can deactivate comments authored by users and moderators, but cannot deactivate comments authored by an admin (`403 Forbidden` with `errors.common.forbidden`).
       - `user`: Can only deactivate their own comments or comments on their own authored recipes.
     - Public presentation: Deactivated comments with active replies are scrubbed to `{ content: null, user: null, user_id: null, is_active: false }`, ensuring zero data leakage while preserving child replies.
   - **Hard Deletion (`?hard=true`)**:
     - **Administrator-Only**: Restricted to `admin` role (`403 Forbidden` if invoked by moderators).
     - **Reply Pruning Safeguard**:
       - If the target comment has child replies and `prune_replies=true` is provided: atomically deletes all child replies and the parent record.
       - If the target comment has child replies and `prune_replies` is false or omitted: rejected with `409 Conflict` (`errors.comment.hasReplies`), requiring explicit confirmation before cascading permanent destruction.
       - If the comment has no replies: permanently deleted immediately.

## Consequences

- Equips moderators with advanced sorting and targeted filtering (by recipe, report count, and edited state) to triage discussions efficiently.
- Eliminates response ballooning in threaded moderation views via windowed reply previews and dedicated reply pagination.
- Enforces strict role hierarchy protecting administrator comments from moderator deactivation.
- Eliminates accidental destruction of conversation threads during permanent comment deletions through explicit `prune_replies` confirmation.
- Guarantees zero sensitive data leakage in public recipe comment trees.
