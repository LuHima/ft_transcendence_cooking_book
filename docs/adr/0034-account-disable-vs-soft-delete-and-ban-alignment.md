# 0034: Account Disable vs. Soft-Delete Separation, Direct Ban Alignment, and Staff Audit Continuity

---
status: accepted
---

We decided to separate reversible **Account Disable** (`PATCH /api/admin/users/:id` with `status: 'disabled'`, `deleted_at: null`) from **Soft Deletion** (`DELETE /api/admin/users/:id` without `hard=true`, `deleted_at` populated, `public`-only **Platform Custody Transfer**, comment deactivation, and query-time hiding of non-public recipes), align direct admin bans (`PATCH /api/admin/users/:id` with `status: 'banned'`) with [ADR-0021](0021-content-report-resolution-lifecycle-and-ban-eviction.md), store staff-only `internal_notes` on `BanHistory`, make `BanHistory.banned_by_id` and `Report.resolved_by_id` nullable (`onDelete: SetNull`), and grant moderators read-only access to `GET /api/admin/users/:id/ban-history`.

## Context

1. **Disable vs. Soft-Delete Redundancy**: Previously, `PATCH /api/admin/users/:id { status: 'disabled' }` and `DELETE /api/admin/users/:id` (`hard=false`) executed virtually identical mutations—both setting `status = 'disabled'` and `deleted_at = now()`, transferring *all* recipes (rather than only `public` recipes per [ADR-0019](0019-admin-user-governance-and-lifecycle-invariants.md)) to `owner_type: 'platform'`, and deactivating comments—making `Disable` and `Delete` indistinguishable in the API and UI.
2. **Direct Admin Ban vs. Report Ban Divergence**: `PATCH /api/admin/users/:id { status: 'banned' }` set `deleted_at = now()` and transferred recipes to platform custody, whereas `AuthService` checks `if (user.deleted_at)` before `if (user.status === 'banned')`, causing directly banned users to receive `errors.users.inactive` instead of structured `403 ACCOUNT_BANNED` errors and preventing temporary ban auto-expiration.
3. **Staff Audit Continuity & Moderator Blind Spot**: `GET /api/admin/users/:id/ban-history` was restricted to `@Roles('admin')` despite moderators using `/moderation`, `BanHistory` lacked a confidential `internal_notes` column matching `Report.resolution_notes`, `Report.resolved_by_id` and `BanHistory.banned_by_id` / `unbanned_by_id` lacked hydrated staff actor summaries, and `BanHistory.banned_by_id` used an implicit non-null `Restrict` foreign key that blocked hard-deleting former staff members.

## Decision

1. **Three-Tier Administrative Account Lifecycle** (amending [ADR-0019](0019-admin-user-governance-and-lifecycle-invariants.md)):
   - **Account Disable** (`PATCH /api/admin/users/:id { status: 'disabled' }`): Sets `status = 'disabled'` and `deleted_at = null`, evicts active JWT sessions, blocks login and public `UsersService` discovery/profiles, and closes any prior open `BanHistory` row (`unban_reason: 'Account disabled'`) with `banned_until = null`. Authored public recipes and comments remain visible and attributed unless individually suspended.
   - **Soft-Delete** (`DELETE /api/admin/users/:id`, `hard=false`): Allowed for `active`, `disabled` (`deleted_at: null`), or `banned` accounts; returns `409 Conflict` if `deleted_at` is already set. Sets `status = 'disabled'` and `deleted_at = now()`, closes any prior open `BanHistory` row (`unban_reason: 'Account soft-deleted'`) with `banned_until = null`, evicts sessions, transfers **only `privacy: 'public'`** recipes to `owner_type: 'platform'`, and deactivates comments (`is_active: false`). Non-public (`private`, `friends_only`) recipes retain `owner_type: 'user'` and their original `is_active` state, and are hidden from non-staff callers at query time whenever `author.deleted_at != null` so reactivation remains lossless and never un-suspends moderator takedowns.
   - **Hard Purge** (`DELETE /api/admin/users/:id?hard=true`): Permanently deletes the user row and disassociates recipes (`owner_type: 'platform'`, `user_id: null`).
2. **Direct Admin Ban Alignment** (extending [ADR-0021](0021-content-report-resolution-lifecycle-and-ban-eviction.md)):
   - `PATCH /api/admin/users/:id { status: 'banned' }` keeps `deleted_at = null`, sets active recipes `is_active = false, suspended_by_ban = true` without Platform Custody Transfer, evicts JWT sessions, records a `BanHistory` sanction, and supports `active -> banned`, `disabled (non-deleted) -> banned`, and `banned -> banned` (closing any prior open `BanHistory` row as `'Superseded by updated ban'`), while rejecting soft-deleted (`deleted_at != null`) targets with `409 Conflict`.
   - Unbanning (`AdminService`) or auto-expiring a temporary ban (`AuthService`) restores only recipes with `suspended_by_ban: true` (`is_active = true, suspended_by_ban = false`); manual/moderator takedowns and author deactivations set `suspended_by_ban = false` so they are never silently restored.
   - Ban-only fields (`ban_reason`, `ban_duration_days`, `is_permanent`, `ban_description`, `internal_notes`) are rejected with `400 Bad Request` unless `status: 'banned'`; `is_permanent: true` combined with `ban_duration_days` is rejected with `400 Bad Request`; `unban_reason` is rejected with `400 Bad Request` unless transitioning `banned -> active`.
3. **Moderator Sanction History Read Access, Confidential Notes & Actor Hydration**:
   - Grant `@Roles('admin', 'moderator')` read-only access to `GET /api/admin/users/:id/ban-history` for any existing user record.
   - Add `internal_notes String? @db.VarChar(1000)` to `BanHistory`, automatically populated from `UpdateReportDto.resolution_notes` on `warn`/`ban` report resolutions and accepted via `UpdateAdminUserDto.internal_notes` on direct admin bans; return it only to staff on Sanction History endpoints and never in `ACCOUNT_BANNED` or notifications.
   - Add `Report.resolved_by` (`onDelete: SetNull`), make `BanHistory.banned_by_id` nullable (`Int?`, `onDelete: SetNull`), and hydrate `resolved_by`, `banned_by`, and `unbanned_by` as `{ id, username, avatar_url }` summaries (even when the issuing staff member is later disabled/soft-deleted).

## Considered Options

- **Keep `PATCH { status: 'disabled' }` identical to soft `DELETE` and make `DELETE` hard-only**: Rejected to preserve [ADR-0019](0019-admin-user-governance-and-lifecycle-invariants.md)'s non-destructive `DELETE` default and existing lifecycle integration guarantees while eliminating UI/API redundancy.
- **Hide `disabled` users' recipes or mutate `is_active = false` on soft-deleted non-public recipes**: Rejected because mutating `is_active` either causes data loss for private drafts upon reactivation or risks inadvertently restoring moderator-suspended content.
- **Keep `BanHistory.banned_by_id` non-nullable (`Restrict`)**: Rejected because it prevented administrators from hard-deleting former staff accounts who had ever issued a moderation sanction.

## Consequences

- **Positive**: Eliminates the `ACCOUNT_BANNED` login bug for admin-issued bans, provides distinct API contracts for suspension vs. soft deletion vs. hard purge, equips moderators with full Sanction History and internal context on `/moderation`, and prevents dangling `#ID` staff references or FK blocks on staff deletion.
- **Dependencies**: Requires a Prisma migration (`ban_history.internal_notes`, nullable `ban_history.banned_by_id`, `reports.resolved_by_id` FK), OpenAPI/Postman sync, and corresponding frontend adaptations in `#209` and `#210`.
