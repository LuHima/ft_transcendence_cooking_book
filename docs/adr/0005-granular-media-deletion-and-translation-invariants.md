# 5. Granular Media Deletion and Translation Invariants

We decided to pair granular media uploads with symmetrical granular deletion endpoints and synchronous filesystem cleanup, while enforcing strict retranslation invariants during recipe updates.

## Context
When deleting an entire recipe or updating recipe media, relational records were deleted in the database via PostgreSQL cascades, but physical media files under `uploads/recipes/` remained on disk as orphaned files. Furthermore, users could not remove individual media assets (such as a cover photo or tutorial video) without deleting the whole recipe.
In multi-language editing, triggering retranslation (`retranslate=true`) while editing a localized translation (e.g. English text on an Italian recipe) resulted in overwriting manual translations with machine translations derived from the canonical source language.

## Decision
1. **Granular Media Deletion Endpoints**:
   - `DELETE /api/recipes/:id/cover`: removes the cover image file and clears `cover_image_url`.
   - `DELETE /api/recipes/:id/video`: removes the tutorial video file and clears `video_url`.
   - `DELETE /api/recipes/:id/steps/:stepNumber/image`: removes the step illustration and clears the step `image_url`.
   - `DELETE /api/recipes/:id/gallery/:mediaId`: removes the gallery photo and deletes the `RecipeMedia` record.
2. **Synchronous Filesystem Cleanup on Recipe Deletion**:
   - `DELETE /api/recipes/:id` queries all associated media files (`cover_image_url`, `video_url`, step `image_url`s, and gallery URLs), removes the recipe from the database (triggering relational cascades), and safely unlinks all physical files from disk.
3. **Retranslation Invariant**:
   - `PATCH /api/recipes/:id` forbids `retranslate=true` if `locale` is specified and differs from `recipe.source_lang`, throwing `400 Bad Request`. Retranslation is only permitted when modifying canonical source language texts.
4. **Metadata Colocation & Module Order**:
   - Mount `GET /api/recipes/metadata` directly inside `RecipeController` before dynamic route `@Get(':id')`, and register `CatalogModule` before `RecipeModule` in `app.module.ts`.
5. **Catalog Pre-validation & Honest Foreign Key Reporting**:
   - `RecipeService.createRecipe` validates that all specified `ingredient_id`s and `tag_id`s exist in the catalog before attempting creation, returning descriptive `400 Bad Request` messages.
   - `PrismaExceptionFilter` maps foreign key violations (`P2003`) by extracting constraint details instead of misattributing failures to the root model name.

## Consequences
- Guaranteed disk storage hygiene: deleted recipes and deleted assets never leave orphaned files on disk.
- Complete RESTful symmetry between media upload and media deletion.
- Authors can safely polish translated texts without fear of machine retranslation clobbering their edits.
- Route collisions between metadata and recipe IDs are permanently eliminated.
