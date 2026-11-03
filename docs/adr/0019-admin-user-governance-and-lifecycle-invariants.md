# 0019: Admin User Governance, Invariant Enforcement, and Lifecycle Management

We decided to establish a dedicated `AdminModule` (`/api/admin/users`) for platform user administration and role management, enforce strict anti-self-sabotage and last-admin safety invariants, implement soft deactivation with platform recipe custody transfer, comment deactivation, and immediate session eviction (with optional hard deletion), guarantee complete isolation against network information leaks in `RecipeProjectionService`, provide atomic reactivation with content restoration, support dedicated avatar management with Sharp WebP transcoding and `.env`-backed domain validation, and expose a RESTful, OpenAPI-documented administrative API.

## Context

1. **42 Subject Requirement**: The *Advanced Permissions System* (Major module, 2 points) requires:
   - View, edit, and delete users (CRUD).
   - Roles management (`admin`, `moderator`, `user`).
   - Different views and actions based on user role.
2. **Frontend Mock Alignment**: The frontend UI ([AdminUsers.tsx](file:///home/daromoli/Documents/42-transcendence/src/frontend/src/pages/admin/AdminUsers.tsx)) was built assuming administrative endpoints under `/admin/users` to search, sort, create, update roles/profiles, toggle statuses, and delete users.
3. **Platform Safety & Lockout Risk**: Without invariant enforcement, an administrator could accidentally demote themselves to a standard user, disable their own account, or delete the sole administrator in the database, locking the system out of administrative controls.
4. **Relational Integrity and Content Preservation on Deletion**: Hard-deleting users who authored public recipes breaks foreign key constraints or causes destructive cascading deletion of valuable community content. Soft deletion must preserve community catalog recipes by transferring public recipes to platform custody while hiding inactive author identities and deactivating social comments non-destructively.
5. **Reversibility of Administrative Actions**: When an administrator reactivates a previously soft-deleted or banned user, their authored content (public recipes transferred to platform custody and deactivated comments) must be seamlessly and atomically restored.
6. **Network Information Leak Prevention**: Merely hiding author information in client-side components while serializing user entities over HTTP introduces a security and privacy leak. The backend projection engine must strictly nullify author payloads for platform-owned content.
7. **Avatar Security & Media Optimization**: Restricting regular users to sanitized binary uploads prevents SSRF, cross-site IP tracking, and XSS. Administrators require dedicated endpoints for avatar management and optional preset/trusted URLs validated against an environment whitelist.

## Decision

1. **Module & Architectural Boundary**:
   - Create a dedicated `AdminModule` (`src/backend/src/admin`) housing `AdminController` and `AdminService`.
   - Guard administrative user endpoints with `@Auth()` and `@Roles('admin')`.
   - Separate administrative user concerns from the standard community member context (`UsersModule`).

2. **REST Endpoints & Sorting Contract**:
   - `GET /api/admin/users`: Paginated user list supporting `page`, `limit`, `search`, `role`, `status`, and `sort` query parameters.
     - Reuses the canonical `UserSort` enum (`username_asc`, `username_desc`, `recipes_count_desc`, `newest`, `oldest`).
     - Defaults to `newest` (`created_at DESC`) when `sort` is omitted, or `username_asc` when `search` is provided.
     - Returns standard pagination envelope `{ items, total, page, limit, total_pages, has_next_page, has_prev_page }`.
   - `POST /api/admin/users`: Administrative user creation accepting mandatory `{ username, email, password, role }` and optional profile fields matching `UpdateUserDto` (`first_name`, `last_name`, `phone`, `address`, `city`, `postal_code`, `birth_date`, `bio`), optional `status` (default `active`), and optional `avatar_url`. Returns 201 Created.
   - `PATCH /api/admin/users/:id`: Updates profile attributes, credentials, role, and status.
   - `DELETE /api/admin/users/:id`: Soft deletion by default; optional `?hard=true` executes permanent removal.
   - `POST /api/admin/users/:id/avatar`: Dedicated multipart/form-data avatar upload with Sharp WebP transcoding.
   - `DELETE /api/admin/users/:id/avatar`: Removes avatar file from disk and nullifies `avatar_url`.

3. **Domain Invariants & Selective Eviction**:
   - **Anti-Self-Sabotage**: An administrator cannot modify their own `role`, cannot transition their own `status` to `disabled` or `banned`, and cannot call `DELETE /api/admin/users/:id` on their own ID (400 Bad Request with `errors.admin.cannotModifySelf`). Admins may update their own profile fields (`first_name`, `bio`, etc.).
   - **Last-Admin Protection**: An administrator cannot be demoted, disabled, or deleted if they are the last active administrator on the platform (409 Conflict with `errors.admin.lastAdminRequired`).
   - **Selective Session Eviction**: Active `jwt_sessions` are purged immediately if and only if security-sensitive attributes change: `password`, `role`, or `status` transitioning to `disabled`/`banned`. Standard profile updates (`first_name`, `bio`, `phone`, etc.) leave active user sessions intact.

4. **Deletion Lifecycle & Platform Custody Transfer**:
   - **Soft Delete by Default**:
     - User account is flagged: `status = 'disabled'`, `deleted_at = new Date()`.
     - Active sessions in `jwt_sessions` are immediately purged.
     - **Recipe Custody**: All authored recipes with `public` visibility transition to `owner_type: 'platform'` while preserving `user_id = id` for referential traceability and future restoration. Non-public recipes (`private`, `friends_only`) remain `owner_type: 'user'` and become hidden.
     - **Comment Footprint**: Authored comments on all recipes are non-destructively deactivated (`is_active = false`), hiding them from public discussion feeds.
     - **Social Discovery**: The disabled account is excluded from public search and friend lists (`GET /api/users`). Recipe like records remain in the database to preserve aggregate counters.
   - **Optional Hard Removal (`?hard=true`)**:
     - All recipes authored by the user are reassigned to `owner_type: 'platform'` and `user_id = null`.
     - The user row and related non-custodial records are permanently deleted from PostgreSQL.

5. **Atomic User Reactivation**:
   - Triggered when `PATCH /api/admin/users/:id` transitions `status` from `disabled` or `banned` to `active`.
   - Executed inside an atomic database transaction:
     - Sets `status = 'active'` and `deleted_at = null`.
     - Reverts platform-custody recipes: `prisma.recipe.updateMany({ where: { user_id: id, owner_type: 'platform' }, data: { owner_type: 'user' } })`.
     - Reactivates authored comments: `prisma.comment.updateMany({ where: { user_id: id, is_active: false }, data: { is_active: true } })`.
     - Clears any active ban restrictions.
     - Requires fresh authentication (old JWT sessions are not resurrected).

6. **Network Information Leak Isolation**:
   - `RecipeProjectionService` strictly serializes `author: null` whenever `recipe.owner_type === 'platform'` or `recipe.user == null`.
   - Prevents soft-deleted or platform-custody user metadata (ID, username, avatar) from leaking over HTTP responses in `GET /api/recipes` and `GET /api/recipes/:id`.
   - `GET /api/users/:id/recipes` filters strictly by `owner_type: 'user'`, returning an empty list or 404 for deactivated accounts.

7. **Avatar Security, Transcoding & Whitelisting**:
   - Regular users are strictly limited to file uploads (`POST /api/users/me/avatar`) and deletions (`DELETE /api/users/me/avatar`). Arbitrary external URLs are rejected to eliminate SSRF, IP harvesting, and XSS risks.
   - All uploaded avatars pass through `sharp` transcoding: strips EXIF metadata, resizes/crops to 512x512, converts to WebP at quality 80, and saves to `AVATAR_UPLOADS_DIR`.
   - Administrators providing `avatar_url` via JSON payload must supply either a relative path to the local uploads directory (`/uploads/avatars/*`) or a secure HTTPS URL matching hostnames configured in `TRUSTED_AVATAR_DOMAINS` in `.env`.

## Consequences

- Fulfills the 42 Common Core *Advanced Permissions System* CRUD, role management, and audit requirements.
- Completely prevents platform lockouts via anti-self-sabotage and last-admin safeguards.
- Protects community recipe integrity by adopting public recipes into platform custody on deletion while honoring privacy boundaries.
- Delivers zero-data-loss, fully reversible account restoration for administrators.
- Eliminates sensitive metadata leaks across client network inspectors by enforcing DTO projection nullification at the backend serialization layer.
- Establishes robust media processing defense-in-depth with Sharp WebP transcoding and environment-based domain whitelisting.
