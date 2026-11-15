# 0035: Administrative Recipe Report Indicators, Counter Semantics Split, and Target Report Lookup

---
status: accepted
---

We decided to isolate the **Administrative Recipe Stream** response schema (`AdminRecipeItemDto` / `PaginatedAdminRecipesResponseDto`) from public recipe discovery, enrich both recipe and comment audit items with distinct all-status (`reports_count`), active-pending (`pending_reports_count`, `has_pending_reports`), and quick-triage (`latest_pending_report_id`) metadata (partially superseding [ADR-0030](0030-admin-recipe-stream-and-moderation-contract-harmonization.md)), add `reported_only` filtering and report-count sorting to `GET /api/admin/recipes`, enforce paired `(subject, target_id)` filtering on `GET /api/reports`, add hydrated single-report inspection at `GET /api/reports/:id`, and index `reports` on `(subject, status, target_id)`.

## Context

1. **Counter Overload in ADR-0030**: [ADR-0030](0030-admin-recipe-stream-and-moderation-contract-harmonization.md) previously overloaded `reports_count` on `AdminCommentItemDto` to duplicate `pending_reports_count` and used `sort_by=reports_count` for pending-report prioritization. That prevented the moderation UI from distinguishing historical resolved/dismissed reports (`!has_pending_reports && reports_count > 0`) from active pending reports.
2. **Public vs. Admin Recipe DTO Coupling**: `GET /api/admin/recipes` returned `PaginatedRecipeResponseDto` (`LocalizedRecipeSummaryResponse`), which is shared with public `GET /api/recipes`, leaving no clean boundary for moderation counters, `reported_only`, or pending report sorting without polluting public OpenAPI schemas.
3. **Target & Deep-Link Navigation Gaps**: `GET /api/reports` lacked `target_id` filtering and the Reports API lacked `GET /api/reports/:id`, forcing staff panels (`AdminRecipes`, `AdminComments`, and `BanHistoryDialog` `report_id` links) to browse paginated queues manually to locate a target's **Content Report**.

## Decision

1. **Semantic Split of `reports_count` vs. `pending_reports_count` & `latest_pending_report_id`** (amending [ADR-0030](0030-admin-recipe-stream-and-moderation-contract-harmonization.md) §1 and §3):
   - Across both **Comment Audit Queue** (`AdminCommentItemDto`) and **Administrative Recipe Stream** (`AdminRecipeItemDto`):
     - `reports_count: number` strictly counts **all** reports regardless of status (`pending + action_taken + dismissed`).
     - `pending_reports_count: number` strictly counts active `status = 'pending'` reports (`has_pending_reports = pending_reports_count > 0`).
     - `latest_pending_report_id: number | null` resolves deterministically to the most recent pending report (`ORDER BY created_at DESC, id DESC`), or `null` when `pending_reports_count === 0` (also populated on each reply in threaded comment previews).
   - `AdminCommentSortBy` adds `pending_reports_count`. On both comment and recipe admin streams:
     - `sort_by=pending_reports_count` sorts by active pending reports (`thread_pending_reports_count` in `format=threaded` for comments).
     - `sort_by=reports_count` sorts by all-status total reports (cumulative thread total in `format=threaded` for comments).
     - When `reported_only=true` and `sort_by` is omitted, both endpoints contextually default to `sort_by=pending_reports_count` descending (tie-broken deterministically). When `reported_only` is omitted or `false`, no report-existence filter is applied.
2. **Isolated Administrative Recipe Stream Contract (`GET /api/admin/recipes`)**:
   - Introduce `AdminRecipeItemDto extends LocalizedRecipeSummaryResponse` and `PaginatedAdminRecipesResponseDto` so public `GET /api/recipes` contracts remain unchanged.
   - Counters and `reported_only=true` on `GET /api/admin/recipes` evaluate strictly against `Report` rows with `subject = 'recipe'`, preserving [ADR-0030](0030-admin-recipe-stream-and-moderation-contract-harmonization.md)'s moderator `private` recipe visibility rule (visible when the recipe *or* any of its comments has a pending report).
   - Override `sort_by` in `AdminRecipeQueryDto` with `AdminRecipeSortBy` (`created_at | total_time | difficulty | likes_count | title | pending_reports_count | reports_count`) using an explicit-override pattern so `FilterRecipeDto`'s default does not mask `reported_only=true` contextual sorting.
3. **Target-Filtered & Single-Report Lookup (`GET /api/reports`, `GET /api/reports/:id`) & Index Coverage**:
   - Extend `ReportQueryDto` on `GET /api/reports` with optional `target_id?: number` (`@Min(1)`), **requiring `subject`** whenever `target_id` is supplied (`400 Bad Request` otherwise) while keeping `status` optional. Missing or empty target histories return `200 OK` with an empty page.
   - Add `GET /api/reports/:id` guarded by `@Auth()` and `@Roles('admin', 'moderator')`, accepting `ParseIntPipe` and `LocaleQueryDto` (`?lang=`), returning the exact hydrated `ReportItemDto` shape (`reporter`, `target`, `previous_bans_count`, `previous_warnings_count`, and `resolved_by`), `404 Not Found` when absent, and `403 Forbidden` for non-staff callers.
   - Add composite index `@@index([subject, status, target_id])` on `Report` in Prisma schema (`prisma migrate dev`) to accelerate `reported_only` filters, batch pending/total count aggregations, and target-scoped lookups.

## Considered Options

- **Reuse `PaginatedRecipeResponseDto` with optional report fields on public `LocalizedRecipeSummaryResponse`**: Rejected to keep public recipe discovery contracts clean and strongly typed separately from staff triage fields.
- **Keep `reports_count` pending-only per ADR-0030 and omit `latest_pending_report_id`**: Rejected because moderation badges already distinguish historical vs. pending reports, and direct `latest_pending_report_id` eliminates a round-trip when triaging single-report rows.
- **Allow `target_id` without `subject` on `GET /api/reports`**: Rejected because `Report.target_id` is polymorphic across recipes, comments, and users and could collide on identical numeric IDs while bypassing the `(subject, ...)` index prefix.

## Consequences

- **Positive**: Achieves feature and metric parity between `AdminRecipes` and `AdminComments`, gives staff accurate pending vs. historical report visibility and 1-click triage links, eliminates cross-entity `target_id` collisions, and optimizes `Report` filtering with composite index coverage.
- **Dependencies**: Requires a Prisma migration for `Report @@index([subject, status, target_id])`, OpenAPI/Postman contract sync, and frontend updates in `#210` (plus `BanHistoryDialog` report link integration in `#209`).
