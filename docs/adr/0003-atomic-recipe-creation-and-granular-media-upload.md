# 3. Atomic Recipe Creation and Granular Media Upload

We decided on an atomic payload for recipe data creation paired with dedicated, granular endpoints for media file uploads.

## Context
A recipe combines complex relational data (steps, ingredients with quantities/notes, tags) and binary media assets (cover image, step photos, gallery photos, tutorial video). Combining binary file uploads and structured JSON in a single multipart endpoint makes validation error reporting messy and prevents granular upload progress indicators.

## Decision
1. `POST /api/recipes` accepts an atomic JSON payload (metadata, steps, ingredients, tags) executed inside a single database transaction.
2. Binary media is uploaded in phase two via dedicated granular endpoints:
   - `POST /api/recipes/:id/cover` (single image)
   - `POST /api/recipes/:id/steps/:stepNumber/image` (single image)
   - `POST /api/recipes/:id/video` (single tutorial video)
   - `POST /api/recipes/:id/gallery` (up to 3 images)

## Consequences
- Guaranteed referential integrity: no recipe can exist without its complete ingredients or steps.
- Clear file size and MIME-type limits per route (e.g. video allows 100MB, images 10MB).
- The frontend can show precise upload progress bars per step/cover.
