# 8. DevOps Environment Parity, Automated Vault Lifecycle, and Resilient TLS

We decided to structure development and production environments using Docker Compose layering (`docker-compose.yml` and `docker-compose.dev.yml`), automate HashiCorp Vault lifecycle across dedicated Makefile rules with three-tier unseal resolution, optimize images via `node:22-slim` multi-stage builds, and implement non-blocking ACME DNS-01 fallback to self-signed TLS certificates.

## Context

1. **Dev/Prod Parity vs. Developer Experience**: Day-to-day development requires live code reloading, host port access (Postgres port 5432 and Prisma Studio port 5555), and Let's Encrypt Staging to prevent rate limits. However, disabling Vault entirely during development causes architectural drift and hides production secret retrieval bugs until evaluation.
2. **Container Image Optimization**: Monolithic development images carry compilation toolchains (`@nestjs/cli`, Vite dev server, TypeScript compiler, devDependencies). While an Alpine migration was considered, Prisma ORM C++ engine binaries depend on `glibc`, making Alpine's `musl libc` prone to segmentation faults.
3. **42 Transcendence Single-Command Evaluation vs. Vault Security**: HashiCorp Vault is sealed upon restart by design (Shamir's Secret Sharing). 42 school staff confirmed that single-command deployment is evaluated _after_ initial machine provisioning. Automatic unseal must be supported when keys are provided in `.env` without removing interactive terminal prompt capabilities.
4. **TLS & Domain Resilience**: `app.we-cook.it` points to `127.0.0.1` via DNS. If DNS-01 challenges fail during offline evaluations or due to missing Infomaniak API credentials, hard exit crashes the gateway Nginx container.

## Decision

1. **Orchestration Layering**: Keep `docker/docker-compose.yml` as the hardened, production-ready base. Create `docker/docker-compose.dev.yml` to inject host volume mounts, expose ports 5432 and 5555, enable `ACME_STAGING=true`, and select `target: development`. Preserve `docker/docker-compose.novault.yml` strictly for emergency plain-text `.env` bypass when `USE_VAULT=false`.
2. **Multi-Stage Base**: Retain `node:22-slim` across all services. For the backend, separate `development`, `builder`, and `production` stages (`node dist/main.js` with `npm ci --omit=dev`). For the frontend, compile static assets in a build stage and serve them in production via a dedicated minimal internal static server on port 5173, preserving `docker/nginx/nginx.conf` reverse proxy configuration unchanged.
3. **Vault Lifecycle in Makefile**:
   - `make vault-init`: Performs one-time setup (initializes Vault, saves 5 keys and root token to `$HOME/vault-keys/vault-init.txt`, unseals temporarily to enable AppRole, writes policies, stores initial database/JWT secrets, and populates role credentials in `docker/.env`).
   - `make vault-unseal [k1 k2 k3]`: Unseals Vault via 3-tier precedence: (1) CLI arguments, (2) `VAULT_UNSEAL_KEY_1..3` from `docker/.env`, (3) interactive terminal prompts.
   - `make` (`all`) and `make setup`: Check Vault status; if sealed, trigger `vault-unseal` before launching containers.
   - `make up`: Retained as a pure `docker compose up -d` wrapper.
   - `make dev` and `make prod`: Explicitly select development overrides or production targets.
4. **ACME DNS-01 Fallback**: In `docker/acme/entrypoint.sh`, attempt Infomaniak DNS-01 challenge first. If credentials are missing or the challenge fails, log a warning and generate a self-signed certificate with Subject Alternative Names (SAN) matching `${DOMAIN_NAME}`, `localhost`, and `127.0.0.1`, guaranteeing zero-downtime service availability.

## Consequences

- Preserves high architectural parity: Vault authentication is exercised consistently in both environments.
- Protects database access on production deployments by closing port 5432 to the host while keeping it accessible in development.
- Eliminates 42 defense blockers: evaluators can inspect single-command startup without manual script choreography.
