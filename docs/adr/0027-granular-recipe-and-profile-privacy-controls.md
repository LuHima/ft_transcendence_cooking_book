# 0022: Granular Recipe and Profile Privacy Controls

We decided to introduce discrete `RecipePrivacy` and `ProfilePrivacy` enums in Prisma (`public`, `friends_only`, `private`), enforce strict query-level visibility filtering across `RecipeService`, `FeedService`, and `UsersService`, adopt secure status code semantics (404 for private content, 403 for friend-only content), and provide gracefully degraded profiles to maintain social discoverability.

## Context

1. **User Control over Culinary Content**: Authors need the ability to maintain private draft recipes, share personal family dishes exclusively with confirmed friends, or publish recipes to the global community cookbook.
2. **Profile Confidentiality vs Social Discovery**: Complete profile cloaking (e.g. returning 404 or 403 on user profiles) breaks social networking by preventing community members from finding each other, verifying identity, or sending friend requests.
3. **Information Disclosure & Enumeration Risks**: Returning `403 Forbidden` for private recipes leaks the existence of confidential drafts to unauthorized callers, enabling ID-harvesting and timing attacks.
4. **Performance & Query Decoupling**: Evaluating friendship permissions per recipe inside JavaScript application loops creates severe N+1 query bottlenecks on paginated feeds.

## Decision

1. **Database Schema Modeling**:
   - `enum RecipePrivacy { public, friends_only, private }`
   - In `model Recipe`: add `privacy RecipePrivacy @default(public)` and an index `@@index([privacy, is_active])`.
   - `enum ProfilePrivacy { public, friends_only, private }`
   - In `model User`: add `profile_privacy ProfilePrivacy @default(public)`.

2. **Access Control & Status Code Semantics**:
   - `GET /api/recipes/:id`:
     - If `recipe.privacy === 'private'`: Accessible only to author (or admin under audit inspection). Any unauthorized caller receives **`404 Not Found`** (`errors.recipe.notFound`).
     - If `recipe.privacy === 'friends_only'`:
       - Unauthenticated caller: returns **`401 Unauthorized`** (`errors.auth.unauthorized`).
       - Authenticated non-friend caller: returns **`403 Forbidden`** (`"This recipe is only visible to confirmed friends of the author"`).
       - Confirmed friend or author: returns **`200 OK`**.
     - If `recipe.privacy === 'public'`: Accessible to all visitors and community members.

3. **Gracefully Degraded Profiles (`GET /api/users/:id`)**:
   - Identity markers (`id`, `username`, `avatar_url`, `bio`, `profile_privacy`) are always returned with **`200 OK`** (unless blocked).
   - If `profile_privacy === 'friends_only'` and viewer is a non-friend (or if `private` and viewer is not self/admin):
     - Sensitive fields (`email`, `first_name`, `last_name`, `phone`, `city`, `birth_date`) are nullified.
     - Authored recipes count and recipe list tab are withheld.
     - Allows visitors to verify the user and send a friend request.

4. **Independence of Recipe & Profile Privacy**:
   - A user's `profile_privacy` does not override their recipes' `privacy` settings. A user with a private profile can still author public recipes discoverable in global search.

5. **Single Round-Trip Query Filtering**:
   - `RecipeService` and `FeedService` resolve accepted friend IDs in one subquery (`getAcceptedFriendIds(viewerId)`) and filter recipes in SQL/Prisma:
     ```ts
     where: {
       is_active: true,
       OR: [
         { privacy: RecipePrivacy.public },
         { user_id: viewerId },
         { privacy: RecipePrivacy.friends_only, user_id: { in: friendIds } },
       ],
     }
     ```

## Consequences

- Prevents resource enumeration and information leakage for private drafts.
- Balances member privacy with frictionless social discovery and friendship establishment.
- Guarantees sub-millisecond query performance on feeds and discovery without N+1 query overhead.
- Unblocks Ticket #84 for protected media access control and streaming.
