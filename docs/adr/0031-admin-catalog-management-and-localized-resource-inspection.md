# 0031: Administrative Catalog Management and Localized Resource Inspection

We decided to introduce a dedicated administrative catalog controller (`AdminCatalogController`) mounted at `/admin/catalog` guarded strictly for the `admin` role (`@Roles('admin')`) to house catalog element creation, modification, deletion, and full multilingual translation inspection, while realigning public single-resource inspection endpoints (`GET /api/ingredients/:id`, `GET /api/tags/:id`) to return localized projections conforming to requested locales.

## Context

1. **Public vs. Administrative Inspection Ambiguity**: In ADR 0030 (Decision 4), single-resource lookup endpoints (`GET /api/ingredients/:id` and `GET /api/tags/:id`) were specified as public endpoints returning localized projections conforming to the requested locale (`?lang=`) with fallback to source/English. However, initial implementation returned complete multilingual dictionaries (`translations: { it, en, fr }`) on these public routes to accommodate admin edit forms, contradicting the public localized projection standard defined in ADR 0030 and `GLOSSARY.md`.
2. **Administrative Namespace Separation**: Administrative mutation operations (`POST /api/ingredients`, `PATCH /api/ingredients/:id`, `DELETE /api/ingredients/:id`, `POST /api/tags`, `PATCH /api/tags/:id`, `DELETE /api/tags/:id`) were previously mounted directly under public catalog root paths (`/api/ingredients`, `/api/tags`). This diverged from other administrative domains (`/api/admin/users`, `/api/admin/comments`, `/api/admin/recipes`), causing routing inconsistency and authorization coupling.
3. **Admin Form Hydration Friction**: In `src/frontend/src/pages/admin/AdminCatalog.tsx`, administrative editing previously fetched three separate localized catalog lists across all languages (`GET /ingredients?lang=it|en|fr`) to reconstruct the full translation dictionary for an entity, because no dedicated administrative single-resource endpoint existed.

## Decision

1. **Dedicated Administrative Catalog API Namespace (`/api/admin/catalog`)**:
   - Implemented `AdminCatalogController` (`src/backend/src/admin/admin-catalog.controller.ts`), guarded at the controller level by `@Auth()` and `@Roles('admin')`.
   - Dedicated administrative inspection endpoints:
     - `GET /api/admin/catalog/ingredients/:id`: Returns full `IngredientDetailResponseDto` containing canonical `slug`, `category`, and complete translation map `translations: { it: string, en: string, fr: string }`.
     - `GET /api/admin/catalog/tags/:id`: Returns full `TagDetailResponseDto` containing canonical `slug` and complete translation map `translations: { it: string, en: string, fr: string }`.
   - Administrative lifecycle mutation endpoints:
     - `POST /api/admin/catalog/ingredients`
     - `PATCH /api/admin/catalog/ingredients/:id`
     - `DELETE /api/admin/catalog/ingredients/:id`
     - `POST /api/admin/catalog/tags`
     - `PATCH /api/admin/catalog/tags/:id`
     - `DELETE /api/admin/catalog/tags/:id`
   - Administrative mutation endpoints are removed from the public `CatalogController`.

2. **Public Localized Single-Resource Projections (`GET /api/ingredients/:id`, `GET /api/tags/:id`)**:
   - Public inspection endpoints under `CatalogController` accept optional query parameter `?lang=` (via `LocaleQueryDto`).
   - `GET /api/ingredients/:id` returns localized `IngredientResponseDto` (`{ id, slug, category, name, resolved_lang }`).
   - `GET /api/tags/:id` returns localized `TagResponseDto` (`{ id, slug, name, resolved_lang }`).
   - Localization resolution strictly follows a 4-tier fallback hierarchy:
     1. Requested language (`?lang=`) if an exact translation match exists.
     2. English (`en`) translation fallback.
     3. First available translation found in the entity's translation records (e.g., if an item only possesses `it` and the client requested `?lang=fr`, it resolves the `it` translation).
     4. Canonical entity `slug` as the ultimate fallback if no translation records exist.
   - Accurately reports `resolved_lang` corresponding to the matched translation locale (or `en` when defaulting to slug). Returns `404 Not Found` for non-existent IDs.

3. **Frontend Integration Contract**:
   - `src/frontend/src/pages/admin/AdminCatalog.tsx` updates its CRUD and translation pre-population calls to query `/api/admin/catalog/ingredients` and `/api/admin/catalog/tags`.
   - The multi-request `loadTranslations` loop in the frontend is replaced with a single `GET /api/admin/catalog/${kind}/${id}` lookup.

## Consequences

- **Positive**:
  - Clear architectural boundary between public localized resource consumption and administrative multilingual catalog management.
  - Public endpoints return lightweight localized projections without leaking unrequested language dictionaries or confusing API clients.
  - Eliminates frontend N-query overhead when editing catalog items: full translation maps are loaded in a single request.
  - Administrative routes are consistently aligned under `/api/admin/*` alongside `admin/users`, `admin/comments`, and `admin/recipes`.
- **Negative / Trade-offs**:
  - Administrative catalog mutation endpoints change paths from `/api/ingredients*` to `/api/admin/catalog/ingredients*`, requiring client callers to migrate to the canonical administrative namespace.
