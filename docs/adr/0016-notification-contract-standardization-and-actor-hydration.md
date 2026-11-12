# 0016: Notification Contract Standardization, Actor Hydration, and REST Ergonomics

We decided to refactor notification routes to idiomatic RESTful paths (`PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications/:id`), hydrate notifications with actor profile cards and target metadata, support localization via `lang` query parameter, and enforce bounded pagination with unread counts.

## Context

1. **REST Anti-Patterns & Broken Routes**: Existing notification endpoints used non-standard paths with action verbs embedded in URLs (`PATCH /notifications/read/:id` and `DELETE /notifications/delete/:id`), while the controller handler had a typographical defect (`readedNotification`).
2. **Severe Under-Fetching & N+1 Waterfall**: `GET /api/notifications` returned only flat rows containing foreign keys (`actor_id: 5`, `target_id: 42`). Client applications were forced to execute sequential requests for every notification to discover who performed the action and what recipe or comment was involved.
3. **Missing Pagination & Performance Risk**: `GET /api/notifications` dumped all notifications for a user into memory without pagination or sorting. Active users with hundreds of alerts suffered severe payload bloat and slow response times.
4. **Lack of Bulk Actions**: Users could only mark notifications as read one by one, creating frustrating UX when opening a notifications center with dozens of unread alerts.
5. **Localization Inconsistency**: The application supports Italian (`it`), English (`en`), and French (`fr`), but notifications were either hardcoded in English or lacked localized messages and recipe titles.

## Decision

1. **Idiomatic RESTful Route Definitions**:
   - `PATCH /api/notifications/:id/read`: Marks a single notification as read.
   - `PATCH /api/notifications/read-all`: Marks all unread notifications for the caller as read.
   - `DELETE /api/notifications/:id`: Permanently deletes a single notification.
   - `GET /api/notifications`: Retrieves paginated, sorted, and hydrated notifications.
2. **Actor & Target Hydration**:
   - Each notification item embeds an `actor` profile summary (nullable for anonymous moderation notices):
     ```typescript
     actor: {
       id: number;
       username: string;
       avatar_url: string | null;
     } | null;
     ```
     - For peer social interactions (`like`, `comment`, `friend_*`), `actor` hydrates the initiating member's public card.
     - For disciplinary moderation notifications (`action: 'warn'`), `actor` is strictly serialized as `null` to shield staff members (administrators and moderators) from personal harassment and retaliatory friction. The client renders the notice as originating generically from the platform moderation team.
   - Each notification item embeds structured `target` metadata:
     ```typescript
     target: {
       id: number | null;
       subject: NotificationSubject;
       title_or_snippet?: string | null;
     }
     ```
   - Each notification embeds a human-readable, localized `message: string` (e.g. *"Mario ha messo 'Mi piace' alla tua ricetta 'Lasagna'"* or *"Hai ricevuto un avviso dal team di moderazione per la tua ricetta 'Lasagna'"*).
   - An optional `details?: string | null` field delivers the user-facing explanation (`resolution_description`) authored by moderation staff for warning notifications.
3. **Query Contract & Localization (`NotificationQueryDto`)**:
   - Extends `PaginationQueryDto` (`page?: number = 1`, `limit?: number = 20`, max 100).
   - `unread_only?: boolean`: Optional filter to retrieve only unread alerts (`is_read: false`).
   - `lang?: 'it' | 'en' | 'fr'`: Target language for localized message text and target recipe title.
   - Ordered strictly by `created_at DESC` (newest notifications first).
4. **Pagination Response Metadata (`PaginatedNotificationResponseDto`)**:
   - `items: NotificationItemDto[]`
   - Standard pagination wrappers: `total`, `page`, `limit`, `total_pages`, `has_next_page`, `has_prev_page`.
   - `unread_count: number`: Total count of unread notifications for the user across the entire inbox.
5. **CASL Authorization & Invariant Status Codes**:
   - Enforce that the authenticated user must be the recipient (`user_id === currentUser.id`).
   - If target notification does not exist: `404 Not Found`.
   - If notification belongs to another user: `403 Forbidden`.

## Consequences

- Completely eliminates client N+1 network request waterfalls when viewing notifications.
- Provides immediate localized notification alerts and badge indicators in a single round-trip.
- Establishes uniform RESTful ergonomics and pagination standards across all backend controllers.
