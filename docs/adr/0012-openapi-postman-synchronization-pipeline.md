# 12. Automated OpenAPI Specification Generation and Postman Collection Synchronization

We decided to decouple OpenAPI specification extraction from runtime database initialization via a headless NestJS generator, enforce documentation freshness on pull requests via zero-diff git checks, synchronize contract updates non-destructively to the canonical Postman collection (`WeCook API`) using Postman's native spec-to-collection synchronization API with background task polling, and maintain a single canonical specification file (`src/backend/openapi.json`) with relative symbolic links for documentation tools.

## Context

1. **Runtime Coupling & Developer Friction**: Previously, generating `openapi.json` required starting the backend application (`main.ts`), which in turn initialized PostgreSQL connections (`PrismaService.$connect()`), required container orchestration, and depended on HashiCorp Vault secrets. As a result, developers rarely regenerated the specification locally when modifying controller endpoints, request DTOs, or validation pipes.
2. **Contract Drift**: Without automated verification, the codebase drifted away from published API documentation and Postman collections. Endpoints, parameters, and schemas diverged, degrading the developer experience for frontend engineers and external consumers.
3. **Destructive Tooling vs. Custom Assertions**: Naive automated conversion approaches (such as `openapi-to-postmanv2` generating an entirely new collection and executing `PUT /collections`) overwrite the remote collection in Postman. This destroys all existing post-response schema test assertions and wipes out pre-request authentication scripts (notably the automatic extraction and persistence of HttpOnly `accessToken` and `refreshToken` session cookies on `/api/auth/signin`).
4. **Collection Fragmentation**: The Postman workspace previously retained multiple collections (`wecook-backend-api` and `wecook-api-generated`), creating confusion regarding the authoritative collection for integration testing.

## Decision

1. **Headless Specification Generation (`src/backend/src/generate-spec.ts`)**:
   - Provide an isolated extraction script that stubs `PrismaService.prototype.onModuleInit` to a no-op before module creation.
   - Inject fallback development environment defaults (`DATABASE_URL`, `PRODUCTION_FLAG=false`).
   - Instantiate application metadata using `NestFactory.create(AppModule, { logger: false })` without binding network sockets or executing background cron jobs.
   - Build the OpenAPI 3.0 document via `SwaggerModule.createDocument()` using the exact `DocumentBuilder` configuration defined in `main.ts`, outputting formatted JSON directly to `src/backend/openapi.json`.
   - Register `npm run openapi:generate` in both backend and root package manifests.

2. **Single Canonical Specification & Symbolic Links**:
   - Establish `src/backend/openapi.json` as the single canonical source of truth for the API contract.
   - Maintain repository root `./openapi.json` and Fern documentation specification `./fern/openapi/openapi.json` as relative symbolic links pointing to `src/backend/openapi.json`.

3. **Non-Destructive Spec-to-Collection Synchronization (`scripts/sync-postman.ts`)**:
   - Implement a TypeScript CLI synchronization client (`scripts/sync-postman.ts`).
   - Resolve `POSTMAN_API_KEY` using a three-tier precedence cascade: (1) `process.env.POSTMAN_API_KEY`, (2) `docker/.env`, (3) `.env`.
   - Upload the updated specification to the Postman API Spec file (`PUT /specs/{specId}/files/{filePath}`).
   - Trigger Postman's native Spec-to-Collection synchronization (`POST /specs/{specId}/collections/{collectionUid}/sync`). Postman's internal diff engine merges route and schema updates while strictly preserving pre-request scripts, environment persistence scripts, and post-response test assertions.
   - Poll the returned asynchronous background task (`GET /specs/{specId}/tasks/{taskId}`) every 2 seconds (up to a 30-second timeout), exiting with code `0` on `COMPLETED` and code `1` on failure or timeout.

4. **Dual-Stage CI/CD Pipeline (`.github/workflows/postman-sync.yml`)**:
   - **Stage 1 (Contract Drift Check on PRs)**: Triggers on pull requests targeting `main` or `dario-APIs` affecting `src/backend/**`. Executes `npm run openapi:generate` and asserts `git diff --exit-code src/backend/openapi.json`. Fails if uncommitted API changes are detected, requiring developers to update the spec before merging. Runs without secrets.
   - **Stage 2 (Postman Synchronization on Push)**: Triggers on push/merge to protected branches (`main`, `dario-APIs`). Executes `npm run postman:sync` using `${{ secrets.POSTMAN_API_KEY }}`.

5. **Postman Workspace Governance**:
   - Consolidate all endpoints under the canonical collection `6cea2a4e-1dde-4ec2-9aa1-e861f9fee048`, updating its remote display name to `"WeCook API"`.
   - Clean obsolete `wecook-backend-api` references from `.postman.json` and standardize the collection key as `wecook-api`.

## Consequences

- **Zero Regression on Test Suites**: Automated Postman updates never overwrite or erase existing schema assertions or authentication token persistence logic.
- **Immediate Drift Detection**: Uncommitted changes to controller routes, DTOs, or parameter pipes immediately fail PR checks in CI with actionable remediation messages.
- **Offline & Port-Free Generation**: Developers can regenerate OpenAPI specs in under 5 seconds without running PostgreSQL, Docker, or Vault.
- **Single Source of Truth**: Backend code, Postman collections, and Fern documentation remain synchronized from a single canonical artifact.
