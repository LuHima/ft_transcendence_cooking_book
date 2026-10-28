# 0010: Unified User Discovery, Composite Search, and Contextual Sorting

We decided to structure `GET /api/users` as a unified collection endpoint for both directory discovery and composite member search, featuring optional authentication, configurable sorting criteria, contextual default sorting, and comprehensive pagination.

## Context

1. **Under-fetching & Fragmented Experience**: The existing `GET /api/users` endpoint required a mandatory `search` query parameter and returned only a bare array of `{ username: string }[]`. The client application could not display user avatars, names, or recipe counts, could not link to user profiles (because user IDs were missing), and could not show relationship states ("Add Friend", "Pending", "Friends") without issuing subsequent queries for every individual item.
2. **Community Discovery vs. Targeted Search**: A culinary social platform requires both targeted searching (finding specific cooks by handle or real name) and exploratory community browsing (discovering top recipe authors or newly joined cooks when no query is entered).
3. **Resource Slicing & REST Ergonomics**: Introducing separate sub-paths (such as `GET /users/search`) fractures collection semantics. In RESTful design, searching is a filtered query on the `/users` collection, not a separate resource.
4. **Authentication Duality**: Unauthenticated visitors should be able to browse public cooks to facilitate onboarding, while logged-in members require real-time relationship context without seeing themselves in search results.

## Decision

1. **Unified Endpoint Contract**: Retain `GET /api/users` as the single collection resource, extending `PaginationQueryDto` (`page`, `limit`).
2. **Optional Composite Search**:
   - Query parameter `search?: string` is optional.
   - When provided (after whitespace trimming), it requires at least 2 characters (`@MinLength(2)`). Queries shorter than 2 characters yield `400 Bad Request`. Whitespace-only queries are treated as omitted.
   - Substring matching is case-insensitive across `username`, `first_name`, and `last_name` using an `OR` condition.
3. **Sorting Enum & Contextual Defaults**:
   - Introduce `UserSort` enum: `username_asc`, `username_desc`, `recipes_count_desc`, `newest`, `oldest`.
   - **Contextual Default**: If `search` is provided, default to `username_asc`. If `search` is omitted, default to `recipes_count_desc` (showcasing top culinary contributors first).
4. **Optional Authentication & Self-Exclusion**:
   - Protect `GET /api/users` with `OptionalAuthGuard`.
   - If anonymous, `friendship_status` is returned as `null`.
   - If authenticated, resolve `friendship_status` (`none`, `pending_sent`, `pending_received`, `friends`) relative to the caller and exclude the caller from results (`id: { not: currentUserId }`).
5. **Enriched User Card Payload (`UserSearchItemDto`)**:
   - `id`: number
   - `username`: string
   - `avatar_url`: string | null
   - `first_name`: string | null
   - `last_name`: string | null
   - `created_at`: Date
   - `recipes_count`: number
   - `friendship_status`: 'none' | 'pending_sent' | 'pending_received' | 'friends' | null
6. **Data Integrity & Account Filtering**:
   - Always filter `status: 'active'` and `deleted_at: null` to avoid leaking deactivated, suspended, or banned accounts.

## Consequences

- Powers both community member directory browsing and real-time search from a single clean endpoint.
- Completely eliminates N+1 network request waterfalls on the client.
- Protects database resources with bounded pagination (default 20, max 100) and minimum query length validations.
