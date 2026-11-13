# 0017: User Moderation, Mutual Blocking, and Content Reporting

We decided to introduce dedicated `UserBlock` and `Report` relational models, implement mutual / bidirectional invisibility between blocked accounts, provide user blocking sub-resources (`POST/DELETE /api/users/:id/block`, `GET /api/users/me/blocks`), and establish content reporting endpoints with role-guarded moderation queues (`POST /api/reports`, `GET/PATCH /api/reports`).

## Context

1. **Lack of Self-Defense & Safety Mechanisms**: Community members had no ability to protect themselves from unwanted contact, harassment, or abusive interactions.
2. **Missing Content Flagging & Moderation Ingestion**: Users could not report offensive recipes, toxic comments, or spam profiles. Administrators lacked a structured triage queue to inspect reported violations.
3. **Visibility & Social Bleed**: When an account is blocked, partial visibility (e.g. seeing their name in search, viewing their comments, or having mutual friend presence) perpetuates conflict and stalking. A social platform requires complete mutual severance.
4. **Relational Invariant Integrity**: If User A blocks User B, existing friendships or pending requests between them cannot remain active, nor should unread social notifications linger.

## Decision

1. **Database Schema Modeling**:
   - `model UserBlock`:
     - `id`: Int @id @default(autoincrement())
     - `blocker_id`: Int
     - `blocked_id`: Int
     - `created_at`: DateTime @default(now())
     - `@@unique([blocker_id, blocked_id])`
     - Foreign keys to `User` with `onDelete: Cascade`.
   - `model Report`:
     - `id`: Int @id @default(autoincrement())
     - `reporter_id`: Int
     - `subject`: `ReportSubject` (`recipe`, `comment`, `user`)
     - `target_id`: Int
     - `reason`: `ReportReason` (`spam`, `harassment`, `inappropriate_content`, `hate_speech`, `copyright`, `other`)
     - `description`: String? @db.VarChar(1000)
     - `status`: `ReportStatus` (`pending`, `reviewed`, `dismissed`, `action_taken`) @default(pending)
     - `resolution_notes`: String? @db.VarChar(1000)
     - `created_at`: DateTime @default(now())
     - `updated_at`: DateTime @updatedAt
2. **Mutual / Bidirectional Invisibility**:
   - When User A blocks User B, A and B become mutually invisible:
     - User search (`GET /api/users`): both accounts are filtered out of each other's search results.
     - Profile lookup (`GET /api/users/:id`, `GET /api/users/by-username/:username`, `GET /api/users/:id/recipes`): returns `404 Not Found`.
     - Social feed (`GET /api/feed`): recipes from blocked users are strictly excluded.
     - Interactions: blocked users cannot like or comment on each other's recipes (returns `404 Not Found`).
     - Friend requests: cannot be sent between blocked users.
3. **Cascade Cleanup on Block Creation**:
   - Deletes any existing `Friendship` record between the two users.
   - Deletes any unread notifications exchanged between the two users.
   - Cannot block oneself (`blocker_id !== blocked_id`).
4. **User Blocking API Surface (`UsersController`)**:
   - `POST /api/users/:id/block`: Blocks target user. Idempotent (catching unique violation).
   - `DELETE /api/users/:id/block`: Unblocks target user.
   - `GET /api/users/me/blocks`: Paginated list of users currently blocked by the authenticated caller.
5. **Content Reporting API Surface (`ReportsModule`)**:
   - `POST /api/reports`: Authenticated members submit a content flag. Duplicate pending reports for the same target by the same reporter return `409 Conflict`.
   - `GET /api/reports`: Moderation review queue guarded by `@Roles('admin', 'moderator')` with pagination and optional `status` filter.
   - `PATCH /api/reports/:id`: Resolves a report, updating status and optional resolution notes, guarded by `@Roles('admin', 'moderator')`.

## Consequences

- Delivers complete self-defense and community safety controls for members.
- Establishes full mutual invisibility to prevent harassment vectors across profiles, feeds, search, and interactions.
- Provides a clean, role-guarded moderation workflow for platform staff.
