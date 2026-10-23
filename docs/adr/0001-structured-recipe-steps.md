# 1. Structured Recipe Steps

We decided to model recipe preparation as ordered `RecipeStep` entities rather than a single monolithic text/markdown block.

## Context
Earlier frontend iterations used a single `<textarea>` for `instructions`. However, the application features an interactive 3D cooking book and recipe detail view where step-by-step progress, duration timers, and step-specific illustrations are essential for user experience.

## Decision
Create a separate `recipe_steps` table linked to `recipes` by foreign key, with `step_number`, `title`, `description`, `duration_minutes`, and `image_url`.

## Consequences
- Requires a relational join or nested include when fetching a recipe.
- Enables rich interactive features: step navigation, timers, and step-by-step photos.
