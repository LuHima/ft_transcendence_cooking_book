# 0027: Granular Recipe and Profile Privacy Controls

We decided to introduce discrete `RecipePrivacy` and `ProfilePrivacy` enums in Prisma (`public`, `friends_only`, `private`), enforce strict query-level visibility filtering across `RecipeService`, `FeedService`, and `UsersService`, adopt secure status code semantics (404 for private content and blocked users, 403/401 for friend-restricted content), support blended search for social discovery, and gate profile sub-resources while maintaining gracefully degraded public identity markers.

## Context

1. **User Control over Culinary Content**: Authors need the ability to maintain private draft recipes, share personal family dishes exclusively with confirmed friends, or publish recipes to the global community cookbook. Authors must be able to adjust privacy levels over time (`public` $\leftrightarrow$ `friends_only` $\leftrightarrow$ `private`) without destroying historical likes and comments.
2. **Profile Confidentiality vs Social Discovery**: Complete profile cloaking breaks social networking by preventing community members from finding each other, verifying identity, or sending friend requests. Degraded profiles provide safe identity verification while hiding private collections.
3. **Information Disclosure & Enumeration Risks**: Returning `403 Forbidden` for private recipes leaks the existence of confidential drafts to unauthorized callers, enabling ID-harvesting and timing attacks. Private content must strictly return `404 Not Found`.
4. **Administrative Audit vs User Confidentiality**: Front-line moderators require recipe context to evaluate reported comments or recipes, but should not have arbitrary browse access over private unshared drafts. Administrators retain platform custody audit rights with audit logging.
5. **Performance & Query Decoupling**: Evaluating friendship permissions per recipe inside JavaScript application loops creates severe N+1 query bottlenecks. Single round-trip queries must resolve friendship boundaries in SQL/Prisma.

## Decision

1. **Database Schema Modeling**:
   - `enum RecipePrivacy { public, friends_only, private }`
   - In `model Recipe`: add `privacy RecipePrivacy @default(public)` and composite index `@@index([privacy, is_active])`.
   - `enum ProfilePrivacy { public, friends_only, private }`
   - In `model User`: add `profile_privacy ProfilePrivacy @default(public)`.

2. **Access Control & Status Code Semantics on `GET /api/recipes/:id`**:
   - If `recipe.privacy === 'private'`:
     - **Author**: returns `200 OK`.
     - **Admin**: returns `200 OK` and logs audit entry (`ADMIN_PRIVATE_RECIPE_INSPECT`).
     - **Moderator**: returns `200 OK` with audit entry (`MODERATOR_PRIVATE_RECIPE_CONTEXT_INSPECT`) **only if** an active pending `Report` exists for this recipe or for any of its comments (`subject IN ('recipe', 'comment')`). Otherwise returns `404 Not Found`.
     - **All other callers**: returns **`404 Not Found`** (`errors.recipe.notFound`).
   - If `recipe.privacy === 'friends_only'`:
     - **Author, Confirmed Friends, Staff**: returns `200 OK`.
     - **Authenticated non-friend**: returns **`403 Forbidden`** (`"This recipe is only visible to confirmed friends of the author"`).
     - **Unauthenticated guest**: returns **`401 Unauthorized`** (`errors.auth.unauthorized`).
   - If `recipe.privacy === 'public'`: Accessible to all callers (`200 OK`).

3. **Gracefully Degraded Profiles (`GET /api/users/:id`)**:
   - Safe identity markers (`id`, `username`, `avatar_url`, `bio`, `profile_privacy`, `friendship_status`, `friends_count`, `recipes_count`) are returned with **`200 OK`**.
   - If `profile_privacy === 'friends_only'` and viewer is non-friend, or if `profile_privacy === 'private'` and viewer is not self/staff:
     - Sensitive personal fields (`email`, `first_name`, `last_name`, `phone`, `city`, `birth_date`) are nullified.

4. **Gating Profile Sub-Resources (`GET /api/users/:id/recipes` & `GET /api/users/:id/friends`)**:
   - **Authored Recipes Tab (`GET /api/users/:id/recipes`)**:
     - If author's `profile_privacy` is `friends_only` (viewer is non-friend) or `private` (viewer is not self/staff): returns **`403 Forbidden`** with `{ code: 'PROFILE_COOKBOOK_RESTRICTED', message: "This user's recipe collection is private." }` (or `401 Unauthorized` for guests).
     - If profile is accessible:
       - Returns `public` recipes to non-friends.
       - Returns `public` and `friends_only` recipes to confirmed friends.
       - Returns `public`, `friends_only`, and `private` recipes exclusively to the author themself.
   - **Confirmed Friends List (`GET /api/users/:id/friends`)**:
     - Follows the author's `profile_privacy`: if `friends_only` (non-friend) or `private` (non-self/staff), returns **`403 Forbidden`** (`PROFILE_FRIENDS_RESTRICTED`) or `401 Unauthorized`.

5. **Blended Global Search & Social Feed Query Filtering**:
   - **Social Feed (`GET /api/feed`)**: Returns recipes where `user_id IN (friendIds)` AND `privacy IN ('public', 'friends_only')` AND `is_active = true`.
   - **Global Recipe Search (`GET /api/recipes`)**: Blended discovery returning recipes where:
     ```prisma
     where: {
       is_active: true,
       OR: [
         { privacy: 'public' },
         { user_id: currentUserId },
         { privacy: 'friends_only', user_id: { in: friendIds } },
       ],
     }
     ```
   - When unauthenticated, queries strictly `{ privacy: 'public', is_active: true }`.

6. **Mutual User Block Invariants**:
   - A `User Block` between User A and User B enforces total mutual invisibility:
     - `GET /api/users/:id` returns `404 Not Found` in both directions.
     - `GET /api/recipes/:id` returns `404 Not Found` in both directions.
     - Feed and search queries exclude all content authored by blocked or blocking users via subquery.

7. **DTO Privacy Badging & Lifecycle Transitions**:
   - `privacy: RecipePrivacy` is included in `RecipeSummaryResponseDto` and `LocalizedRecipeDetailResponse`.
   - Authors can update `privacy` at any time via `PATCH /api/recipes/:id`. Likes, comments, and metrics are preserved across transitions.

8. **Comprehensive Privacy and Visibility Matrix**:
   - The authoritative endpoint response matrix mapping all HTTP status codes, payloads, and role permissions across privacy tiers is documented in [docs/privacy-and-visibility-matrix.md](../privacy-and-visibility-matrix.md).

## Consequences

- Prevents resource enumeration and information leakage for private drafts and blocked accounts.
- Preserves context for fair moderation triage while enforcing strict audit accountability.
- Delivers a unified blended search experience where friends can search for recipes seen in their feed.
- Protects private cookbooks and friend networks without breaking identity verification and friend requests.
- Maintains sub-millisecond database queries via single round-trip SQL `OR` clauses and indexed privacy columns.
