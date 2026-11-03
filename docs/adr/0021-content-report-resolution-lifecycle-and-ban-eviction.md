# 0021: Content Report Resolution Lifecycle, Hierarchical Bans, and Session Eviction

We decided to standardize content report resolution exclusively on `PATCH /api/reports/:id` (rejecting RPC-style verbs), enforce author resolution for content-level bans, establish temporary and permanent ban semantics with a 90-day moderator cap, execute immediate two-pronged session and WebSocket eviction, and record complete resolution audit trails on the `Report` entity.

## Context

1. **RESTful Architecture**: The frontend initially drafted an RPC-style `POST /api/reports/:id/resolve`. Standardizing on `PATCH /api/reports/:id` aligns with REST resource-state modification semantics without endpoint proliferation.
2. **Author Resolution on Content Reports**: A community member reports a specific abusive `comment` or copyright-infringing `recipe`. When staff sanctions the offense with an account ban, the system must resolve the underlying author and apply the ban while checking role hierarchy.
3. **Role Hierarchy in Enforcement**: While administrators have unilateral governance authority, platform moderators must not be permitted to ban administrators or issue permanent bans.
4. **Session Eviction**: Banning an account in the database without immediately invalidating active JWT credentials allows the banned actor to continue publishing abusive content until their JWT expires.

## Decision

1. **Canonical REST Resolution Contract (`PATCH /api/reports/:id`)**:
   - Guarded by `@Auth()` and `@Roles('admin', 'moderator')`.
   - Payload (`ResolveReportDto`):
     - `action`: `ReportAction` enum (`dismiss`, `warn`, `delete_content`, `ban`).
     - `resolution_notes`: optional string describing the rationale.
     - `ban_duration_days`: optional integer (default `7`, range `1..90` for moderators).
     - `permanent`: optional boolean (default `false`).
   - Deprecate and reject `POST /api/reports/:id/resolve`.

2. **Hierarchical Ban Execution**:
   - **Author Resolution**:
     - `subject === 'user'`: bans `target_id`.
     - `subject === 'recipe'`: resolves `recipe.user_id` and bans the recipe author.
     - `subject === 'comment'`: resolves `comment.user_id` and bans the comment author.
   - **Role Hierarchy**:
     - Moderators **cannot** ban an Administrator (`403 Forbidden`).
     - Admins can ban any user or moderator.
   - **Duration Boundaries**:
     - **Moderators**: `permanent` must be `false` and `ban_duration_days` must not exceed `90`. Setting `permanent = true` or `ban_duration_days > 90` is rejected with `403 Forbidden`. If omitted, defaults to `7` days.
     - **Admins**: If `permanent === true`, sets `banned_until = null`. If `permanent === false`, sets `banned_until = now() + (ban_duration_days ?? 7) days`.

3. **Immediate Two-Pronged Eviction**:
   - When a user is banned:
     1. **Database Session Purge**: All rows in `jwt_sessions` matching `id_user = targetUserId` are immediately deleted, causing all future HTTP requests with existing JWTs to fail authentication (`401 Unauthorized`).
     2. **WebSocket Eviction**: An internal event notifies `NotificationGateway` to forcefully terminate all active WebSocket connections belonging to `targetUserId`.

4. **Content Deactivation**:
   - `action === 'delete_content'`:
     - For `comment`: sets `is_active = false` and prunes unread reply notifications.
     - For `recipe`: sets `is_active = false` (or `status = 'disabled'`), removing it from public feeds, search results, and 3D books while preserving database records for audit and appeals.

5. **Report Audit Trail**:
   - Add `resolved_by_id: Int?`, `resolution_action: String?`, and `resolved_at: DateTime?` to `model Report`.
   - On resolution, transition `status` to `action_taken` (or `dismissed` if dismissed), and record the resolving staff member, timestamp, action, and notes.

## Consequences

- Delivers a pure RESTful moderation API compliant with `api-design-principles`.
- Protects staff hierarchy by strictly limiting moderator sanctions.
- Guarantees immediate platform expulsion of bad actors upon ban.
- Provides a verifiable audit trail for peer evaluations and administrative review.
