# 0019: Admin User Governance, Invariant Enforcement, and Lifecycle Management

We decided to establish a dedicated `AdminModule` (`/api/admin/users`) for platform user administration and role management, enforce strict anti-self-sabotage and last-admin safety invariants, implement soft deactivation with immediate session eviction (with optional hard platform transfer), and expose a RESTful, OpenAPI-documented administrative API.

## Context

1. **42 Subject Requirement**: The *Advanced Permissions System* (Major module, 2 points) requires:
   - View, edit, and delete users (CRUD).
   - Roles management (`admin`, `moderator`, `user`).
   - Different views and actions based on user role.
2. **Frontend Mock Alignment**: The frontend UI ([AdminUsers.tsx](file:///home/daromoli/Documents/42-transcendence/src/frontend/src/pages/admin/AdminUsers.tsx)) was built assuming administrative endpoints under `/admin/users` to search, create, update roles, toggle statuses, and delete users.
3. **Platform Safety & Lockout Risk**: Without invariant enforcement, an administrator could accidentally demote themselves to a standard user, disable their own account, or delete the sole administrator in the database, locking the system out of administrative controls.
4. **Relational Integrity on Deletion**: Hard-deleting users who authored public recipes breaks foreign key constraints or causes destructive cascading deletion of valuable community content.

## Decision

1. **Module & Architectural Boundary**:
   - Create a dedicated `AdminModule` (`src/backend/src/admin`) housing `AdminController` and `AdminService`.
   - Guard the entire controller with `@Auth()` and `@Roles('admin')`.
   - Separate administrative user concerns from the standard community member context (`UsersModule`).

2. **Domain Invariants**:
   - **Anti-Self-Sabotage**: An administrator cannot modify their own `role`, cannot transition their own `status` to `disabled` or `banned`, and cannot call `DELETE /api/admin/users/:id` on their own ID. Any such attempt is rejected with `400 Bad Request` (`errors.admin.cannotModifySelf`).
   - **Last-Admin Protection**: Before updating an admin's role away from `admin`, or changing an admin's status to `disabled`/`banned`, or deleting an admin, verify that at least one other active administrator exists. If none exists, reject with `409 Conflict` (`errors.admin.lastAdminRequired`).

3. **Account Deletion & Session Eviction**:
   - **Soft Delete by Default**: `DELETE /api/admin/users/:id` sets `status = 'disabled'` and `deleted_at = new Date()`, rendering the account immediately inactive across authentication, search, and social feeds while preserving historical relational data.
   - **Optional Hard Removal**: If `?hard=true` is specified, all recipes authored by the user are reassigned to `owner_type: 'platform'` and `user_id = null`, before the user row is permanently deleted from PostgreSQL.
   - **Immediate Session Eviction**: Whenever a user's status is set to `disabled`/`banned`, their password is reset, or their account is deleted, all corresponding records in `jwt_sessions` are immediately purged to terminate active sessions across all devices.

4. **REST API Contract**:
   - `GET /api/admin/users`: Paginated user list with optional `page`, `limit`, `search`, `role`, and `status` query filters, returning `{ items, total, page, limit, total_pages, has_next_page, has_prev_page }`.
   - `POST /api/admin/users`: Creates a user with `{ username, email, password, role, status? }`, hashing passwords with bcrypt (10 rounds).
   - `PATCH /api/admin/users/:id`: Updates `{ username?, email?, role?, status?, password? }`. Supplying `password` resets credentials and evicts active sessions.
   - `DELETE /api/admin/users/:id`: Executes soft (or optional hard) deletion with session eviction.

## Consequences

- Fulfills the 42 subject *Advanced Permissions System* CRUD and role management requirements.
- Guarantees platform continuity by preventing accidental self-lockout or total loss of administrative access.
- Preserves community recipe catalog integrity during user deletions.
- Seamlessly connects with the existing React `AdminUsers.tsx` dashboard.
