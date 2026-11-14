# 0033: Environment-Aware Modular Seeding and Catalog Expansion

We decided to replace the monolithic, destructively resetting `seed.ts` with a domain-modular `prisma/seed/` architecture controlled by `DB_SEED_ENV` (`dev | prod`), make container-startup seeding non-destructive and idempotent in both modes, bootstrap production admins exclusively from Vault/environment credentials via compiled JavaScript in the production container, and expand the curated ingredient catalog to ~3,000 multilingual Open Food Facts entries loaded via chunked PostgreSQL bulk upserts.

## Context

1. **Monolithic & Destructive Seed**: The original 3,100-line `seed.ts` ran `deleteMany()` across 15 tables on every container restart (destroying developer and evaluator data) while skipping `users`, `user_blocks`, `reports`, `ban_history`, and `jwt_sessions`—leaving polymorphic `Report.target_id` references dangling if reports were added.
2. **Production Startup Gap**: The `production` stage of `docker/backend/dockerfile` runs `npm ci --omit=dev`, omitting `prisma`, `dotenv`, and `tsx`; `entrypoint.sh` checked for `./node_modules/.bin/prisma` and silently skipped both `prisma migrate deploy` and `prisma db seed` in production.
3. **42 Defense vs. Production Parity**: Project evaluation may run the hardened `production` Docker stack (`PRODUCTION_FLAG=true`) while still requiring rich demo accounts, privacy tiers, moderation queues, and paginated data. Conversely, real production deployments require zero mock users/recipes and no hardcoded `Password123` accounts.
4. **Catalog & Fixture Gaps**: Only 57 ingredients were seeded, and several seeded fixtures violated application contracts (plaintext TOTP secret crashing `EncryptionService.decrypting`, `spam_bot` banned without `BanHistory`, fake `youtube.com` video URLs bypassing `MediaModule` HTTP 206 streaming, external Unsplash URLs on private recipes bypassing `MediaAccessControl`, self-likes, missing notifications, and <20 records per paginated endpoint).

## Decision

1. **Seed Mode Decoupling (`DB_SEED_ENV`)**:
   - Introduce `DB_SEED_ENV=dev|prod`, defaulting to `prod` when `PRODUCTION_FLAG=true` and `dev` otherwise, overridable explicitly to `DB_SEED_ENV=dev` when running the production stack for 42 defense.
2. **Non-Destructive Startup Idempotency**:
   - **All environments**: `catalog.seeder` always upserts the curated `Ingredient` and `Tag` dictionaries.
   - **`prod` mode**: `users.seeder` creates the initial `admin` account only when zero admins exist in the database, reading `SEED_ADMIN_EMAIL`, `SEED_ADMIN_USERNAME` (env) and `SEED_ADMIN_PASSWORD` (Vault `secret/backend` when `USE_VAULT=true`, or `.env` when `USE_VAULT=false`). Fails fast if unset on an uninitialized database; never seeds mock users, recipes, comments, or social/moderation data.
   - **`dev` mode**: `users.seeder` upserts baseline personas with `update: {}` (preserving runtime mutations), and `recipes`, `social`, and `moderation` seeders run only when `recipes` count is `0` (or when `DB_SEED_RESET=true` / `make db-reset` explicitly wipes all tables in FK order and cleans seeded files in `UPLOADS_DIR`).
3. **Production Container Execution**:
   - Move `prisma`, `@prisma/adapter-pg`, `pg`, and `dotenv` into runtime `dependencies` (keeping `tsx` in `devDependencies`), enable `resolveJsonModule`, compile `prisma/seed/` cleanly via a dedicated `tsconfig.seed.json`, copy static JSON catalogs and a single copy of local `.webp`/`.mp4` seed assets into the `production` image (`COPY --from=builder /usr/src/app/prisma ./prisma`, so `make prod` with `DB_SEED_ENV=dev` works self-contained during 42 defense while remaining inert in `prod`), emit `dist/src/main.js` directly without shell shims, and run `npx prisma migrate deploy` plus `node dist/prisma/seed/index.js` (prod) / `npx prisma db seed` (dev) in `entrypoint.sh`.
4. **Offline-Curated ~3,000-Ingredient Catalog & Bulk Upsert**:
   - Maintain an offline extraction/curation script that filters Open Food Facts `ingredients.json`—excluding E-numbers, additives, industrial food-label derivatives (`% fat` / `easy-to-spread` butter variants, concentrates, aromas, `CI Natural` dyes, industrial extracts/powders while allowlisting culinary pantry staples like baking/cocoa/spice powders, vanilla/almond extracts, and dark chocolate %; keeping plain `Butter` and `Salted butter`), and incomplete translations—into a committed static `ingredients.json` (~2,874 culinary items across the 9 `IngredientCategory` values with `it`, `en`, `fr` names, preserving all 57 baseline slugs).
   - Load catalogs via chunked PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` queries rather than sequential Prisma upserts so startup stays sub-second.
5. **100% Curated Multilingual Seed Dataset (Zero Procedural Clones)**:
   - Seed 32 fully curated multilingual recipes (`20` primary showcase recipes with newer staggered `created_at` timestamps to occupy Page 1 under default `created_at DESC` sorting, plus `12` additional curated recipes filling Page 2 across `friends_only`, `private` + reported, `is_active: false`, and mixed `TranslationSource`/`TranslationStatus.failed` states), `30` named user personas (no `"Chef Demo01"` loops), persona-authored comments/replies, and moderation fixtures whose actual text visibly matches each `ReportReason`.
6. **Local Protected Culinary Media Fixtures (Per-Recipe Isolation)**:
   - Bundle real culinary photos (downloaded from Unsplash under the Unsplash License and converted locally to optimized ~800px `.webp` assets—replacing broken legacy URLs with live Unsplash replacements) plus short `.mp4` tutorial clips under `prisma/seed/assets/`. Copy each recipe's media into `UPLOADS_DIR` under unique per-recipe filenames (`r<recipeId>-<filename>`) so deleting or updating one seeded recipe's media never unlinks files referenced by sibling recipes, and persist canonical `/api/media/recipes/:recipeId/:filename` paths so `MediaAccessControl` (ADR-0028) and HTTP 206 Range streaming operate identically to user uploads.

## Considered Options

- **Procedurally generated recipes (`#1..#30`), loop users (`Chef Demo01`), and template comments (`Pizza comment #X`) for pagination volume**: Rejected after initial evaluation because numbered clones, repetitive comments, and random ingredient pairings degraded the demo experience during 42 defense; replaced by 32 distinct curated recipes and 30 curated users with staggered timestamps.
- **Derive seed mode strictly from `PRODUCTION_FLAG` / `NODE_ENV`**: Rejected because 42 defense evaluations may run `make prod` (`PRODUCTION_FLAG=true`) while needing demo data.
- **Sequential Prisma `upsert()` loop for ~3,000 ingredients**: Rejected because ~12,000 individual round-trips on every container boot would add 15–30s of startup latency.
- **Fetch Open Food Facts or call LibreTranslate at seed runtime**: Rejected to keep startup fast, deterministic, and functional in offline/airgapped environments.
- **Keep `tsx` in production dependencies**: Rejected to keep TypeScript execution tooling out of the minimal production runtime image.

## Consequences

- **Positive**: Container restarts never wipe developer or evaluator data; production containers apply migrations and bootstrap safely without `devDependencies`; evaluators can exercise every privacy tier, `BanHistory` escalation, `Platform Custody Transfer`, `Friend Request Cooldown`, `Windowed Reply Preview`, 2FA login, and multi-page pagination out of the box.
- **Dependencies / Trade-offs**: Seeding ~3,000 ingredients assumes the catalog pagination contract defined in [ADR-0032](0032-catalog-and-ban-history-pagination-contract.md) (and its corresponding frontend adaptations) so `GET /api/ingredients`, `RecipeForm`, and `AdminCatalog` do not render unbounded lists.
