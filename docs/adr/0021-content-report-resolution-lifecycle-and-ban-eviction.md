# 0021: Content Report Resolution Lifecycle, Hierarchical Bans, and Session Eviction

We decided to standardize content report resolution exclusively on `PATCH /api/reports/:id` supporting atomic composite actions (`actions: ReportAction[]`), enforce an expanded taxonomy of standardized violation categories (`ReportReason`), establish a baseline ban duration policy matrix with an elevated 180-day moderator cap, record complete dual-purpose resolution details (`resolution_reason`, user-facing `resolution_description`, and internal `resolution_notes`), track repeat offenders via an immutable `BanHistory` model, provide explicit structured feedback (`ACCOUNT_BANNED`) upon login attempts, and execute immediate two-pronged session and WebSocket eviction.

## Context

1. **RESTful Architecture & Composite Sanctions**: A single reported offense (such as hate speech in a recipe) frequently warrants multiple simultaneous actions: both taking down the offending content (`delete_content`) and suspending the responsible user (`ban`). Accepting an array of actions (`actions: ReportAction[]`) allows atomic resolution in a single HTTP transaction without endpoint proliferation.
2. **Standardized Violation Taxonomy**: Disciplinary decisions must be guided by objective, well-defined categories rather than vague classifications. Both community reporters and staff triage need aligned reason codes (`spam_scam`, `harassment_bullying`, `hate_speech`, `sexual_content`, `violence_threats`, `copyright_infringement`, `impersonation_misinformation`, `other`).
3. **Policy Duration Defaults & Elevated Moderator Authority**: To prevent arbitrary punishment, each violation category carries a standard default duration. Moderation authorities need discretionary power to adjust durations, but to manage severe infractions effectively while retaining safety boundaries, the moderator duration cap is set to 180 days (with permanent bans reserved for administrators).
4. **Distinction Between User Notice and Internal Audit**: A user who is sanctioned needs an explanation of why their content was penalized (`resolution_description`), while staff need a dedicated channel for internal notes, investigation details, and rationale (`resolution_notes`).
5. **Repeat Offender Visibility**: Deactivating and reactivating accounts without preserving past ban records erases institutional memory, preventing staff from applying progressive discipline against chronic offenders.
6. **Transparent Banned Account Feedback**: Generic "user inactive" errors upon login confuse sanctioned members. Banned users must receive structured, explicit notice stating the violation reason, duration, and expiration timestamp.

## Decision

1. **Canonical REST Resolution Contract (`PATCH /api/reports/:id`)**:
   - Guarded by `@Auth()` and `@Roles('admin', 'moderator')`.
   - Payload (`ResolveReportDto`):
     - `status`: `ReportStatus` (`action_taken` or `dismissed`).
     - `actions`: array of `ReportAction` (`dismiss`, `warn`, `delete_content`, `ban`). Allows composite actions such as `['delete_content', 'ban']`.
     - `resolution_reason`: `ReportReason` enum (mandatory when `status === 'action_taken'`).
     - `resolution_description`: optional user-facing explanation (up to 1000 characters) detailing the violation (e.g. "Explicit imagery in recipe gallery").
     - `resolution_notes`: optional internal staff notes (up to 1000 characters) documenting evidence and triage rationale.
     - `ban_duration_days`: optional integer overriding the policy default.
     - `permanent`: optional boolean (default `false`, admin-only).

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

3. **Hierarchical Ban Execution & 180-Day Boundary**:
   - **Author Resolution**:
     - `subject === 'user'`: bans `target_id`.
     - `subject === 'recipe'`: resolves `recipe.user_id` and bans the recipe author.
     - `subject === 'comment'`: resolves `comment.user_id` and bans the comment author.
   - **Role Hierarchy**:
     - Moderators **cannot** ban an Administrator (`403 Forbidden` with `errors.common.forbidden`).
     - Admins can ban any user or moderator.
   - **Duration Boundaries**:
     - **Moderators**: `permanent` must be `false` and `ban_duration_days` cannot exceed **180 days** (returns `403 Forbidden` if exceeded).
     - **Admins**: Can set custom duration or issue permanent bans (`permanent: true`, setting `banned_until = null`).

4. **Immutable Ban History & Repeat Offender Tracking**:
   - Introduce `BanHistory` model in `schema.prisma`:
     - `user_id`: target sanctioned account.
     - `banned_by_id`: staff member who issued the ban.
     - `reason`: `ReportReason`.
     - `resolution_description`: user-facing explanation.
     - `ban_duration_days`: duration in days (null if permanent).
     - `is_permanent`: boolean.
     - `banned_at`: timestamp of ban execution.
     - `unbanned_at`: timestamp of de-escalation/unban.
     - `report_id`: optional foreign key to the originating `Report`.
   - In moderation queues and user profiles, hydrate `previous_bans_count: number` and recent ban records.
   - Progressive discipline guideline: 1st offense = standard default; 2nd offense = double duration ($2\times$); 3rd offense = 180-day cap (moderator) or permanent ban (admin).

5. **Immediate Two-Pronged Eviction & Login Feedback**:
   - Purge all records from `jwt_sessions` for `targetUserId` immediately upon ban.
   - Forcefully disconnect live WebSocket connections belonging to `targetUserId` via `NotificationGateway`.
   - In `AuthService.signIn`: if `user.status === UserStatus.banned`, return **`403 Forbidden`** with structured error:
     `{ code: 'ACCOUNT_BANNED', message: '...', details: { reason, banned_until, is_permanent } }`.

6. **Content Deactivation & Audit Trail**:
   - When `actions` includes `delete_content`:
     - For `comment`: sets `is_active = false` and prunes unread reply notifications.
     - For `recipe`: sets `is_active = false`, hiding it from discovery, search, author archives, and friend feeds.
   - Record `resolved_by_id`, `resolution_reason`, `resolution_description`, `resolution_notes`, and `resolved_at` on model `Report`.

## Consequences

- Equips staff with composite resolution power, eliminating multi-request friction when banning users and removing offensive content.
- Standardizes disciplinary duration baselines across the moderation team while capping moderator bans at 180 days.
- Differentiates user-facing penalty explanations from internal moderator notes.
- Eliminates moderation blind spots regarding recidivism by creating an immutable ban history record.
- Provides clear, transparent feedback to banned users attempting to authenticate without requiring email infrastructure.