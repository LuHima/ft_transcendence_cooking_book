# 0023: Role-Hierarchical Recipe Suspension, Administrative Hard Takedown, and Content Report Integration

We decided to introduce a non-destructive recipe suspension flag (`is_active: Boolean @default(true)`), enforce strict role hierarchy across recipe deactivation and deletion, restrict permanent purging (`?hard=true`) strictly to platform administrators, allow staff restoration via `PATCH /api/recipes/:id`, and integrate recipe suspension into content report resolution.

## Context

1. **Destructive vs. Non-Destructive Moderation**: Previously, recipe deletion was solely permanent and could only be executed by the recipe's author. When community members reported offensive or copyright-violating culinary content, moderators and administrators had no mechanism to suspend or take down recipes.
2. **Evidence Preservation and Appeal Invariants**: Permanently deleting reported recipes immediately deletes steps, ingredients, translations, and uploaded media files. If an author successfully appeals a false report, their recipe cannot be recovered. A reversible suspension mechanism is necessary to hide content from the public while preserving data for audit and appeal.
3. **Role Hierarchy in Moderation**: In accordance with platform governance rules (ADR 0019 and ADR 0020), platform moderators must not possess the authority to moderate, suspend, or delete content authored by administrators.
4. **Relational and Storage Cleanup for Permanent Takedowns**: When an administrator permanently purges illegal content (`?hard=true`), all relational dependencies (such as comments, likes, and notifications) and associated media files on disk storage must be cleaned up transactionally.
5. **Content Report Triage Streamlining**: Report resolution on recipes with `delete_content` should automatically trigger recipe suspension, recording the resolving staff member and resolution timestamp.

## Decision

1. **Recipe Suspension Schema (`is_active`)**:
   - Added `is_active Boolean @default(true)` to `Recipe` in `prisma/schema.prisma`.
   - Exposed `is_active: boolean` in `LocalizedRecipeSummaryResponse` and `LocalizedRecipeDetailResponse`.
   - Added `is_active?: boolean` in `UpdateRecipeDto` to allow staff restoration.

2. **Public Discovery Filtering**:
   - Filter `is_active: true` in all public discovery queries: `GET /api/recipes`, author profile recipes `GET /api/users/:id/recipes`, and friend feed `GET /api/feed`.
   - On `GET /api/recipes/:id`, return `404 Not Found` for inactive recipes unless the requester is the recipe author, a moderator, or an administrator.

3. **Role Hierarchy Enforcement (`DELETE /api/recipes/:id` & `RecipeService.deactivateRecipe`)**:
   - Standard users can only deactivate/delete recipes they authored.
   - Platform moderators can deactivate recipes authored by standard users and fellow moderators. They are strictly prohibited from deactivating recipes authored by administrators (`403 Forbidden`).
   - Platform administrators can deactivate any recipe.

4. **Permanent Hard Takedown (`DELETE /api/recipes/:id?hard=true`)**:
   - The query parameter `hard: boolean` defaults to `false` (soft suspension).
   - Setting `hard=true` is restricted exclusively to platform administrators (`403 Forbidden` for regular users and moderators).
   - Administrative hard deletion transactionally deletes comments, recipe notifications, recipe database records, and removes all associated media files from disk.

5. **Staff Reactivation (`PATCH /api/recipes/:id`)**:
   - Regular users cannot modify `is_active`.
   - Platform staff (moderators and admins) can restore suspended recipes by setting `is_active: true`.
   - Moderators cannot reactivate recipes authored by administrators (`403 Forbidden`).

6. **Content Report Resolution Integration (`PATCH /api/reports/:id`)**:
   - Resolving a report targeting a recipe with `status: action_taken` and `resolution: delete_content` invokes `RecipeService.deactivateRecipe`, enforcing the role hierarchy check.
   - Resolving with `action: ban` bans the author user account, automatically deactivates all active recipes authored by the user, and evicts active JWT sessions.
   - Records `resolved_by_id` and `resolved_at` on the `Report` record and emits an audit log.

## Consequences

- Resolves Issue #103 and child tickets #104, #105, #106.
- Prevents accidental loss of culinary content while ensuring offensive recipes are immediately hidden from public discovery.
- Upholds role hierarchy across all moderation actions.
- Synchronizes OpenAPI documentation and Postman collections with all endpoints and DTO updates.
