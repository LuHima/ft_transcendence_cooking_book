# 0021: Content Report Resolution Lifecycle, Hierarchical Bans, and Session Eviction

We decided to standardize content report resolution exclusively on `PATCH /api/reports/:id` supporting atomic composite actions (`actions: ReportAction[]`) with strict mutual exclusivity constraints, persist an explicit `actions` array on `Report`, enforce an expanded taxonomy of standardized violation categories (`ReportReason`), establish a baseline ban duration policy matrix with an elevated 180-day moderator cap, shield staff identity on warning notifications (`actor: null`), record complete dual-purpose resolution details (`resolution_reason`, user-facing `resolution_description`, and internal `resolution_notes`), track both warnings and bans via an immutable `BanHistory` ledger, provide explicit structured feedback (`ACCOUNT_BANNED`) upon login attempts, and execute immediate two-pronged session and WebSocket eviction.

## Context

1. **RESTful Architecture & Composite Sanctions**: A single reported offense (such as hate speech in a recipe) frequently warrants multiple simultaneous actions: both taking down the offending content (`delete_content`) and suspending the responsible user (`ban`), or removing content and issuing an advisory warning (`warn`). Accepting an array of actions (`actions: ReportAction[]`) allows atomic resolution in a single HTTP transaction without endpoint proliferation.
2. **Action Mutex & Composability Invariants**: Without explicit validation, contradictory actions could be combined (e.g. attempting to archive a report with `dismiss` while simultaneously applying `ban`, or combining warning and banning). Valid combinations must be unambiguous: `dismiss` stands strictly alone; `warn` and `ban` are mutually exclusive; `delete_content` can stand alone or pair with either `warn` or `ban`.
3. **Staff Identity Shielding**: When delivering disciplinary warnings, exposing the specific moderator or administrator's identity, avatar, and profile link in notification payloads invites retaliatory harassment and personal conflict. Moderation notices must emanate anonymously from the platform moderation team (`actor: null`).
4. **Standardized Violation Taxonomy**: Disciplinary decisions must be guided by objective, well-defined categories rather than vague classifications. Both community reporters and staff triage need aligned reason codes (`spam_scam`, `harassment_bullying`, `hate_speech`, `sexual_content`, `violence_threats`, `copyright_infringement`, `impersonation_misinformation`, `other`).
5. **Policy Duration Defaults & Elevated Moderator Authority**: To prevent arbitrary punishment, each violation category carries a standard default duration. Moderation authorities need discretionary power to adjust durations, but to manage severe infractions effectively while retaining safety boundaries, the moderator duration cap is set to 180 days (with permanent bans reserved for administrators).
6. **Distinction Between User Notice and Internal Audit**: A user who is sanctioned needs an explanation of why their content was penalized (`resolution_description`), while staff need a dedicated channel for internal notes, investigation details, and rationale (`resolution_notes`).
7. **Repeat Offender Visibility & Warning History**: Deactivating and reactivating accounts or issuing ephemeral warnings without preserving historical records erases institutional memory, preventing staff from applying progressive discipline against chronic offenders. Tracking both warnings and suspensions allows moderators to see prior infractions immediately.
8. **Transparent Banned Account Feedback**: Generic "user inactive" errors upon login confuse sanctioned members. Banned users must receive structured, explicit notice stating the violation reason, duration, and expiration timestamp.

## Decision

1. **Canonical REST Resolution Contract (`PATCH /api/reports/:id`)**:
   - Guarded by `@Auth()` and `@Roles('admin', 'moderator')`.
   - Payload (`ResolveReportDto`):
     - `status`: `ReportStatus` (`action_taken` or `dismissed`).
     - `actions`: array of `ReportAction` (`dismiss`, `warn`, `delete_content`, `ban`).
       - **Action Mutual Exclusivity & Composition Rules**:
         - `dismiss`: must stand alone (`actions: ['dismiss']`). It cannot coexist with `warn`, `ban`, or `delete_content`.
         - `warn` and `ban`: strictly mutually exclusive. Passing both (`['warn', 'ban']`) returns `400 Bad Request`.
         - `delete_content`: composable with either `warn` (`['warn', 'delete_content']`) or `ban` (`['ban', 'delete_content']`), or executable as a standalone action (`['delete_content']`).
     - `resolution_reason`: `ReportReason` enum (mandatory when `status === 'action_taken'`).
     - `resolution_description`: optional user-facing explanation (up to 1000 characters) detailing the violation (e.g. "Explicit imagery in recipe gallery").
     - `resolution_notes`: optional internal staff notes (up to 1000 characters) documenting evidence and triage rationale.
     - `ban_duration_days`: optional integer overriding the policy default.
     - `permanent`: optional boolean (default `false`, admin-only).
   - **Report Model Persistence**:
     - Model `Report` in `schema.prisma` stores an explicit `actions: ReportAction[] @default([])` column, preserving the exact composite actions executed at resolution time for audit and historical inspection.

2. **Standardized Violation Taxonomy & Policy Duration Matrix**:
   - `ReportReason` enum:
     - `spam_scam`: Default ban **7 days**.
     - `copyright_infringement`: Default ban **14 days**.
     - `impersonation_misinformation`: Default ban **14 days**.
     - `harassment_bullying`: Default ban **30 days**.
     - `sexual_content`: Default ban **30 days**.
     - `hate_speech`: Default ban **30 days**.
     - `violence_threats`: Default ban **60 days**.
     - `other`: Default ban **7 days**.
   - If `ban_duration_days` is omitted when applying a ban, the service applies the policy default corresponding to `resolution_reason`.

3. **Hierarchical Moderation Authority & Role Invariants**:
   - **Author Resolution**:
     - `subject === 'user'`: targets `target_id`.
     - `subject === 'recipe'`: resolves `recipe.user_id` and targets the recipe author.
     - `subject === 'comment'`: resolves `comment.user_id` and targets the comment author.
   - **Role Hierarchy Safeguards**:
     - Moderators **cannot** ban, delete content of, or issue warnings to an Administrator (`403 Forbidden` with `errors.common.forbidden`).
     - Admins can moderate, warn, or ban any regular user or moderator.
   - **Duration Boundaries**:
     - **Moderators**: `permanent` must be `false` and `ban_duration_days` cannot exceed **180 days** (returns `403 Forbidden` if exceeded).
     - **Admins**: Can set custom duration or issue permanent bans (`permanent: true`, setting `banned_until = null`).

4. **Warning Execution & Staff Identity Shielding**:
   - When `actions` includes `warn`:
     - Dispatches a real-time event and in-app notification to the target author (`subject: report.subject`, `action: 'warn'`, `target_id: report.target_id`, `details: resolution_description`).
     - **Staff Anonymity**: The outward notification payload serializes `actor: null` to the recipient, displaying the alert as originating generically from the platform moderation team. The individual moderator or administrator's identity, avatar, and profile link are strictly withheld from client delivery to protect staff from harassment and retaliation.
     - Does not alter account access (`status` remains `active`) and does not evict sessions. Content remains active unless `delete_content` is also specified.
     - If the notification delivery fails, the error is logged and swallowed so report resolution and database records remain consistent.

5. **Sanction Ledger & Repeat Offender Tracking (Warnings & Bans)**:
   - Extend `BanHistory` model in `schema.prisma` with `action ReportAction @default(ban)`:
     - `user_id`: target sanctioned account.
     - `banned_by_id`: staff member who issued the sanction (retained for confidential staff audit).
     - `action`: `ReportAction` (`ban` or `warn`).
     - `reason`: `ReportReason`.
     - `description`: user-facing explanation (`resolution_description`).
     - `ban_duration_days`: duration in days (populated for temporary bans, null for warnings and permanent bans).
     - `is_permanent`: boolean (true for permanent bans, false for warnings and temporary bans).
     - `banned_at`: timestamp of sanction execution.
     - `unbanned_at`: timestamp of de-escalation/unban.
     - `report_id`: optional foreign key to the originating `Report`.
   - In moderation queues and user profiles, hydrate both `previous_bans_count: number` and `previous_warnings_count: number` alongside historical sanction ledgers.
   - Progressive discipline guideline:
     - 1st offense = Warning (`warn`) or standard default ban depending on severity.
     - 2nd offense = Double duration ($2\times$) ban.
     - 3rd offense = 180-day cap (moderator) or permanent ban (admin).

6. **Immediate Two-Pronged Eviction & Login Feedback**:
   - Purge all records from `jwt_sessions` for `targetUserId` immediately upon ban.
   - Forcefully disconnect live WebSocket connections belonging to `targetUserId` via `NotificationGateway`.
   - In `AuthService.signIn`: if `user.status === UserStatus.banned`, return **`403 Forbidden`** with structured error:
     `{ code: 'ACCOUNT_BANNED', message: '...', details: { reason, banned_until, is_permanent } }`.

7. **Content Deactivation & Audit Trail**:
   - When `actions` includes `delete_content`:
     - For `comment`: sets `is_active = false` without overwriting the original content, and prunes unread reply notifications. Public comment APIs mask deactivated comment content and author details; staff moderation views retain the original content for audit.
     - For `recipe`: sets `is_active = false`, hiding it from discovery, search, author archives, and friend feeds.
   - Record `actions`, `resolved_by_id`, `resolution_reason`, `resolution_description`, `resolution_notes`, and `resolved_at` on model `Report`.

## Consequences

- Equips staff with composite resolution power, eliminating multi-request friction when banning users, issuing warnings, and removing offensive content.
- Enforces strict mutual exclusivity constraints (`dismiss` standalone, `warn` and `ban` mutually exclusive), preventing contradictory moderation states.
- Shields staff identity from retaliatory harassment by masking warning notification actors (`actor: null`).
- Establishes a complete disciplinary audit trail by persisting executed `actions` on `Report` and recording both warnings and bans in `BanHistory`.
- Standardizes disciplinary duration baselines across the moderation team while capping moderator bans at 180 days.
- Differentiates user-facing penalty explanations from internal moderator notes.
- Eliminates moderation blind spots regarding recidivism by exposing both prior warning and ban counts.
- Provides clear, transparent feedback to banned users attempting to authenticate without requiring email infrastructure.