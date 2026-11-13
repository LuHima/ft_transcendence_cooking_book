# Recipe and Profile Privacy Visibility Matrix
**Version 1.0.0** · 42-transcendence · 2026-11-10 · [ADR 0027] [Tickets #142, #143, #144, #145, #146]

---

## AI READING INSTRUCTION

Read `[SPEC]` blocks for authoritative status codes, payload shapes, and query contracts.
Read `[NOTE]` blocks only if additional architectural context or rationale is needed.
`[?]` blocks are unverified.

---

## 1. Comprehensive Visibility Matrix

**[SPEC]**
| Target Resource & Sub-Resource | Privacy Tier | Guest (Unauthenticated) | Stranger (Authenticated Non-friend) | Confirmed Friend | Author (Self) | Moderator | Admin | Mutual Blocked Account |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Recipe Detail**<br>`GET /api/recipes/:id` | `public` | `200 OK` | `200 OK` | `200 OK` | `200 OK` | `200 OK` | `200 OK` | `404 Not Found` |
| | `friends_only` | `401 Unauthorized` | `403 Forbidden` | `200 OK` | `200 OK` | `200 OK` | `200 OK` | `404 Not Found` |
| | `private` | `404 Not Found` | `404 Not Found` | `404 Not Found` | `200 OK` | `200 OK` *(if reported)*<br>`404 Not Found` *(otherwise)* | `200 OK` *(audit logged)* | `404 Not Found` |
| **User Profile**<br>`GET /api/users/:id`<br>`GET /api/users/by-username/:username` | `public` | Full Profile | Full Profile | Full Profile | Full Profile (`me`) | Full Profile | Full Profile | `404 Not Found` |
| | `friends_only` | Degraded Profile | Degraded Profile | Full Profile | Full Profile (`me`) | Full Profile | Full Profile | `404 Not Found` |
| | `private` | Degraded Profile | Degraded Profile | Degraded Profile | Full Profile (`me`) | Full Profile *(audit)* | Full Profile *(audit)* | `404 Not Found` |
| **Author Cookbook**<br>`GET /api/users/:id/recipes` | `public` profile | `200 OK`<br>*(public recipes only)* | `200 OK`<br>*(public recipes only)* | `200 OK`<br>*(public + friends_only)* | `200 OK`<br>*(all: pub, friend, priv)* | `200 OK`<br>*(public + friends_only)* | `200 OK`<br>*(public + friends_only)* | `404 Not Found` |
| | `friends_only` profile | `401 Unauthorized` | `403 Forbidden`<br>`PROFILE_COOKBOOK_RESTRICTED` | `200 OK`<br>*(public + friends_only)* | `200 OK`<br>*(all: pub, friend, priv)* | `200 OK`<br>*(public + friends_only)* | `200 OK`<br>*(public + friends_only)* | `404 Not Found` |
| | `private` profile | `401 Unauthorized` | `403 Forbidden`<br>`PROFILE_COOKBOOK_RESTRICTED` | `403 Forbidden`<br>`PROFILE_COOKBOOK_RESTRICTED` | `200 OK`<br>*(all: pub, friend, priv)* | `403 Forbidden`<br>*(use direct audit)* | `200 OK` *(admin audit)*<br>`403 Forbidden` *(public API)* | `404 Not Found` |
| **Friends List**<br>`GET /api/users/:id/friends` | `public` profile | `200 OK` | `200 OK` | `200 OK` | `200 OK` | `200 OK` | `200 OK` | `404 Not Found` |
| | `friends_only` profile | `401 Unauthorized` | `403 Forbidden`<br>`PROFILE_FRIENDS_RESTRICTED` | `200 OK` | `200 OK` | `200 OK` | `200 OK` | `404 Not Found` |
| | `private` profile | `401 Unauthorized` | `403 Forbidden`<br>`PROFILE_FRIENDS_RESTRICTED` | `403 Forbidden`<br>`PROFILE_FRIENDS_RESTRICTED` | `200 OK` | `200 OK` | `200 OK` | `404 Not Found` |
| **Global Recipe Search**<br>`GET /api/recipes` | N/A | `200 OK`<br>*(public only)* | `200 OK`<br>*(public + self)* | `200 OK`<br>*(blended: public + friends_only from friends + self)* | `200 OK`<br>*(all self + friends + public)* | `200 OK`<br>*(blended)* | `200 OK`<br>*(blended)* | Filtered out in SQL |
| **Social Feed**<br>`GET /api/feed` | N/A | `401 Unauthorized` | `200 OK`<br>*(empty feed if no friends)* | `200 OK`<br>*(public + friends_only from confirmed friends)* | `200 OK` | `200 OK` | `200 OK` | Filtered out in SQL |

**[NOTE]**
- **Degraded Profile Definition**: Returns HTTP `200 OK` with safe public identity markers (`id`, `username`, `avatar_url`, `bio`, `profile_privacy`, `friendship_status`, `friends_count`, `recipes_count`) while nullifying sensitive personal fields (`email`, `phone`, `first_name`, `last_name`, `city`, `birth_date`).
- **Private Recipe Isolation**: Private recipes are never listed in `GET /api/users/:id/recipes` for anyone other than the author (`viewerId === targetUserId`), even when viewed by administrators on the public profile view.
- **Mutual User Block Invariant**: Enforces total mutual invisibility in both directions. Any direct attempt to retrieve a blocked/blocking user or their recipes returns `404 Not Found`.

---

## 2. Recipe Detail Semantics (`GET /api/recipes/:id`)

**[SPEC]**
1. **`privacy === 'public'`**:
   - HTTP `200 OK` for all callers (Guest, Stranger, Friend, Author, Staff).
2. **`privacy === 'friends_only'`**:
   - Guest (no token): HTTP `401 Unauthorized` (`errors.auth.unauthorized`).
   - Authenticated non-friend: HTTP `403 Forbidden`:
     ```json
     {
       "statusCode": 403,
       "error": "Forbidden",
       "message": "This recipe is only visible to confirmed friends of the author"
     }
     ```
   - Confirmed friend, Author, Staff: HTTP `200 OK`.
3. **`privacy === 'private'`**:
   - Author (`currentUserId === recipe.user_id`): HTTP `200 OK`.
   - Administrator (`role === 'admin'`): HTTP `200 OK` with asynchronous audit log entry (`ADMIN_PRIVATE_RECIPE_INSPECT`).
   - Moderator (`role === 'moderator'`):
     - If active pending `Report` exists for recipe or its comments (`subject IN ('recipe', 'comment')`): HTTP `200 OK` with audit log (`MODERATOR_PRIVATE_RECIPE_CONTEXT_INSPECT`).
     - If no active pending report exists: HTTP `404 Not Found` (`errors.recipe.notFound`).
   - All other callers: HTTP `404 Not Found` (`errors.recipe.notFound`).
4. **Mutual Block Active**:
   - HTTP `404 Not Found` regardless of recipe privacy tier.

**[NOTE]**
Returning `404 Not Found` rather than `403 Forbidden` for private recipes is essential to prevent ID enumeration and confidential draft leakage.

---

## 3. User Profile Semantics (`GET /api/users/:id` & `/by-username/:username`)

**[SPEC]**
1. **Full Profile Payload**:
   - Includes identity fields (`id`, `username`, `avatar_url`, `bio`, `profile_privacy`, `friendship_status`, `friends_count`, `recipes_count`, `created_at`) AND personal fields (`first_name`, `last_name`, `email`, `phone`, `city`, `birth_date`).
2. **Degraded Profile Payload**:
   - Masked fields:
     ```json
     {
       "first_name": null,
       "last_name": null,
       "email": null,
       "phone": null,
       "city": null,
       "birth_date": null
     }
     ```
   - Identity markers preserved to enable social discovery and friend requests:
     ```json
     {
       "id": 42,
       "username": "chef_mario",
       "avatar_url": "https://...",
       "bio": "Passionate about Italian cuisine.",
       "profile_privacy": "friends_only",
       "friendship_status": "none",
       "friends_count": 12,
       "recipes_count": 8
     }
     ```
3. **Trigger Criteria for Degraded Presentation**:
   - Target `profile_privacy === 'friends_only'` AND viewer is NOT confirmed friend, self, or staff.
   - Target `profile_privacy === 'private'` AND viewer is NOT self or staff.

---

## 4. Profile Sub-Resources Semantics

**[SPEC]**

### 4.1 Authored Recipes Tab (`GET /api/users/:id/recipes`)
1. **Access Check against Author's `profile_privacy`**:
   - If profile is `friends_only` AND caller is not friend, self, or staff:
     - Guest: HTTP `401 Unauthorized`.
     - Stranger: HTTP `403 Forbidden`:
       ```json
       {
         "statusCode": 403,
         "error": "Forbidden",
         "code": "PROFILE_COOKBOOK_RESTRICTED",
         "message": "This user's recipe collection is private."
       }
       ```
   - If profile is `private` AND caller is not author or staff:
     - Guest: HTTP `401 Unauthorized`.
     - Stranger / Friend: HTTP `403 Forbidden` (`code: 'PROFILE_COOKBOOK_RESTRICTED'`).
2. **Collection Content Filtering (When Accessible)**:
   - For Stranger / Guest: Returns only `privacy: 'public'` recipes.
   - For Confirmed Friend / Staff: Returns `privacy: 'public'` AND `privacy: 'friends_only'` recipes.
   - For Author (`viewerId === targetUserId`): Returns all recipes (`public`, `friends_only`, and `private`).

### 4.2 Confirmed Friends List (`GET /api/users/:id/friends`)
1. **Access Check against Target's `profile_privacy`**:
   - `public`: HTTP `200 OK` (returns paginated friends).
   - `friends_only`:
     - Confirmed friends, Self, Staff: HTTP `200 OK`.
     - Non-friends: HTTP `403 Forbidden`:
       ```json
       {
         "statusCode": 403,
         "error": "Forbidden",
         "code": "PROFILE_FRIENDS_RESTRICTED",
         "message": "This user's friends list is private."
       }
       ```
     - Guests: HTTP `401 Unauthorized`.
   - `private`:
     - Self, Staff: HTTP `200 OK`.
     - All other callers: HTTP `403 Forbidden` (`code: 'PROFILE_FRIENDS_RESTRICTED'`).

---

## 5. Blended Global Search & Social Feed Discovery

**[SPEC]**

### 5.1 Global Recipe Search (`GET /api/recipes`)
- **Unauthenticated (Guest)**:
  ```prisma
  where: {
    is_active: true,
    privacy: 'public'
  }
  ```
- **Authenticated Member**:
  ```prisma
  where: {
    is_active: true,
    OR: [
      { privacy: 'public' },
      { user_id: currentUserId },
      { privacy: 'friends_only', user_id: { in: acceptedFriendIds } }
    ],
    author: {
      AND: [
        { blockers: { none: { blocker_id: currentUserId } } },
        { blocking: { none: { blocked_id: currentUserId } } }
      ]
    }
  }
  ```

### 5.2 Social Feed (`GET /api/feed`)
- **Query Filter**:
  ```prisma
  where: {
    is_active: true,
    user_id: { in: acceptedFriendIds },
    privacy: { in: ['public', 'friends_only'] },
    author: {
      AND: [
        { blockers: { none: { blocker_id: currentUserId } } },
        { blocking: { none: { blocked_id: currentUserId } } }
      ]
    }
  }
  ```
- Private recipes (`privacy: 'private'`) are strictly excluded.
- Results ordered descending by `created_at`.

---

## 6. Mutual User Block Invariants

**[SPEC]**
- When a `User Block` exists between User A and User B (in either direction):
  - `GET /api/users/:id` $\to$ `404 Not Found`.
  - `GET /api/users/by-username/:username` $\to$ `404 Not Found`.
  - `GET /api/recipes/:id` $\to$ `404 Not Found`.
  - `GET /api/users/:id/recipes` $\to$ `404 Not Found`.
  - `GET /api/users/:id/friends` $\to$ `404 Not Found`.
  - `GET /api/recipes` and `GET /api/feed` $\to$ completely omitted in SQL subquery.
- Unblocking is managed via `Settings` $\to$ `Blocked Accounts` (`GET /api/users/me/blocks` and `DELETE /api/users/:id/block`).

---

## 7. Traceability & Lineage

**[SPEC]**
- **Architecture Decision Record**: [docs/adr/0027-granular-recipe-and-profile-privacy-controls.md](file:///home/daromoli/Documents/42-transcendence/docs/adr/0027-granular-recipe-and-profile-privacy-controls.md)
- **Domain Glossary**: [GLOSSARY.md](file:///home/daromoli/Documents/42-transcendence/GLOSSARY.md) (`Recipe Privacy`, `Profile Privacy`, `Degraded Profile`, `Blended Recipe Search`, `Audited Private Inspection`)
- **Parent Implementation Spec**: [#142](https://github.com/LuHima/ft_transcendence_cooking_book/issues/142)
- **Child Implementation Tickets**:
  - [#143](https://github.com/LuHima/ft_transcendence_cooking_book/issues/143) (Prisma Schema Privacy Enums, Indexes & Recipe DTO Extensions)
  - [#144](https://github.com/LuHima/ft_transcendence_cooking_book/issues/144) (Recipe Detail Access Control, Status Code Semantics & Audited Staff Inspection)
  - [#145](https://github.com/LuHima/ft_transcendence_cooking_book/issues/145) (Gated Profile Sub-Resources & Degraded Public Profiles)
  - [#146](https://github.com/LuHima/ft_transcendence_cooking_book/issues/146) (Single Round-Trip Blended Search & Social Feed Visibility Filtering)
- **Future Feature Proposal**: [#141](https://github.com/LuHima/ft_transcendence_cooking_book/issues/141) (Asymmetric User Block Visibility)
