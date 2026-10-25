# 4. Relational Multilingual Translations and Automated LibreTranslate Engine

We decided to model all text content in relational translation tables (`RecipeTranslation`, `RecipeStepTranslation`) and automate translations across Italian, English, and French upon creation using a dedicated LibreTranslate service.

## Context
Recipes are read hundreds of times more frequently than they are authored. Generating translations on-the-fly at read time creates intolerable latency, network bottlenecks, and prevents language-specific database indexing. In addition, supporting potential future languages (e.g. Spanish) requires a schema that does not require database migrations for every added locale.

## Decision
1. Split `Recipe` into invariant metadata (author, times, servings, difficulty, course, media URLs, `source_lang`, `translation_status`) and relational `RecipeTranslation` records keyed by `(recipe_id, locale)`.
2. Model steps with `RecipeStep` and relational `RecipeStepTranslation` records keyed by `(step_id, locale)`.
3. Store `source_lang` to record the author's original writing and preserve the canonical source of truth.
4. During `POST /api/recipes`, validate `source_lang` against LibreTranslate `/detect` (rejecting high-confidence mismatches), and synchronously translate text into the other two languages.
5. If LibreTranslate is unavailable, gracefully fall back to storing source text across locales, set `translation_status: 'failed'`, and provide an idempotent retry endpoint (`POST /api/recipes/:id/translate`).

## Consequences
- Unlimited scalability: additional languages can be seeded or translated with zero Prisma schema changes.
- Direct localized database queries and instant rendering in the 3D book and search feeds.
- High resilience: temporary translation service outages do not cause recipe submission failures.
