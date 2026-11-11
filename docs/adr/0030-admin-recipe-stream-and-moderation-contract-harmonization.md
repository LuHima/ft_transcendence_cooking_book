# 0030: Administrative Recipe Stream and Moderation Contract Harmonization

We decided to introduce a dedicated administrative recipe triage stream (`GET /api/admin/recipes`) guarded for `admin` and `moderator` roles enforcing role-scoped privacy boundaries per ADR 0027, enrich the content reports queue (`GET /api/reports`) with contextual reporter profiles and polymorphic target metadata across recipes, comments, and users, extend the administrative comment audit stream (`GET /api/admin/comments`) with a `reported_only` filter, pending report indicators, and guaranteed reported reply previews, provide public single-resource inspection endpoints (`GET /api/ingredients/:id`, `GET /api/tags/:id`) for catalog entities, and propagate recipe context (`recipe_id`) across REST notifications and real-time WebSocket events.

## Context

1. **Administrative Content Oversight & Visibility Boundaries**: Previously, administrators and moderators triaging recipes had to rely on the public `GET /api/recipes` discovery stream or individual `GET /api/recipes/:id` lookups. The public endpoint strictly restricts results to active public recipes and authenticated friends-only recipes, filtering out inactive recipes and private drafts. Staff required a dedicated stream supporting status filtering (`active`, `inactive`, `all`) while strictly maintaining the platform visibility matrix established in ADR 0027 (administrators inspect all privacy tiers; moderators access public and friends-only recipes, plus private recipes only when actively reported).
2. **Moderation Queue Triaging Friction**: The content reports queue (`GET /api/reports`) previously returned raw subject identifiers (`subject`, `target_id`) and `reporter_id` without contextual hydration. Staff had to execute separate queries to discover who submitted a report, what recipe was targeted, who authored the reported comment, or which recipe a reported comment belonged to.
3. **Audit Stream Reported Comments Priority**: In high-traffic culinary discussions, moderators reviewing `GET /api/admin/comments` needed an explicit mechanism to isolate comments with pending community reports (`reported_only=true`) rather than browsing all platform remarks. Furthermore, threaded views could omit reported child replies if newer unflagged replies pushed them outside the default windowed preview.
4. **Notification Context Gaps**: Social notifications (`GET /api/notifications` and WebSocket `newNotification` events) lacked direct `recipe_id` context for comment events, forcing client applications to fetch comment details or parse arbitrary URLs before routing the user to the affected recipe page.
5. **Catalog Resource Inspection**: While dictionary endpoints returned complete lists of ingredients and tags, client applications and moderation tools lacked a direct, single-resource lookup API (`GET /api/ingredients/:id` and `GET /api/tags/:id`) to resolve localized labels and category mappings for specific IDs.

## Decision

1. **Dedicated Administrative Recipe Stream (`GET /api/admin/recipes`)**:
   - Implemented in `AdminRecipesController` (`src/backend/src/admin/admin-recipes.controller.ts`), guarded by `@Auth()` and `@Roles('admin', 'moderator')`.
   - Supports query parameter `status: 'active' | 'inactive' | 'all'` (defaults to `all`).
   - Reuses catalog filtering (`course`, `difficulty`, `author_id`, `min_time`, `max_time`, `max_prep_time`, `source_lang`, `curated_only`, `tag_ids`, `ingredient_ids`, `search`) and sorting contracts (`sort_by`, `sort_order`, `page`, `limit`) via refactored `RecipeService` helpers (`applyCatalogFilters`, `buildCatalogSqlFilters`).
   - Role-scoped privacy visibility:
     - **Administrator**: Unrestricted access across `public`, `friends_only`, and `private` tiers regardless of lifecycle status.
     - **Moderator**: Access to `public` and `friends_only` recipes, plus `private` recipes **only if** an active pending `Report` exists against the recipe itself or against one of its comments. Mutual blocks do not apply to staff triage streams.

2. **Contextual Hydration for Reports Queue (`GET /api/reports`)**:
   - Enriched `ReportItemDto` with:
     - `reporter`: `{ id, username, avatar_url }`
     - `target`: Polymorphic summary containing `label`, `recipe_id` (for recipe and comment subjects), and `owner` (`{ id, username, avatar_url }`).
   - Handled gracefully across all report subjects (`recipe`, `comment`, `user`) even when targeted entities or authors have been removed or deleted.

3. **Reported Comments Audit Stream & Pending Indicators (`GET /api/admin/comments`)**:
   - Added `reported_only?: boolean` filter to `AdminCommentQueryDto`. When `true`, automatically applies contextual defaults: sorts by `reports_count: desc` and switches format to `flat` unless explicitly overridden.
   - Enriched comment response DTOs with `pending_reports_count: number` and `has_pending_reports: boolean`.
   - For `format=threaded`, added `reported_replies_count: number` and guaranteed that reported child replies are included in the embedded preview array up to `replies_limit`.

4. **Single-Resource Catalog Inspection API**:
   - Implemented `GET /api/ingredients/:id` and `GET /api/tags/:id` in `CatalogController`, returning localized entities conforming to requested locale with fallback to source/English.
   - Publicly accessible without authentication, returning `404 Not Found` for non-existent resource IDs.

5. **Notification Recipe Context Hydration**:
   - Extended `NotificationTargetDto` with nullable `recipe_id: number | null`.
   - Hydrated `target.recipe_id` in `NotificationService.getNotifications` for `subject: 'recipe'` and `subject: 'comment'` (resolved from the comment's parent recipe).
   - Augmented `NotificationEmit` WebSocket payloads (`newNotification`) to include `recipe_id` in real-time target structures.

## Consequences

- **Positive**:
  - Staff workflows are dramatically accelerated: moderators and administrators can audit, triage, and filter reported content and administrative recipe archives without executing manual multi-step joins or external lookups.
  - Platform privacy boundaries remain mathematically preserved: private recipes remain invisible to moderators unless an active pending report warrants inspection.
  - Zero code duplication between public recipe search and administrative streams via shared query-building helpers.
  - Client applications can navigate directly from notifications and reports to corresponding recipe views using canonical `recipe_id` fields.
  - Frontend applications can query isolated catalog resources on demand without transferring multi-kilobyte catalog datasets.
- **Negative / Trade-offs**:
  - Moderation report listings execute lightweight batch joins to hydrate reporter and polymorphic target summaries; this is mitigated through indexed primary key lookups and pagination limits (`limit <= 100`).
