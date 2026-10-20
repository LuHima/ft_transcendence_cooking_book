# **************************************************************************** #
#    GENERAL INFO                                                              #
# **************************************************************************** #

# Name of the project
NAME =			WeCook

# Docker compose file and environment configuration paths
COMPOSE_FILE =	./docker/docker-compose.yml
ENV_FILE =		./docker/.env
ENV_EXAMPLE =	./docker/.env.example

# Vault flag: with USE_VAULT=false in the env file the stack runs in
# development mode (secrets read straight from the env file, Vault unused).
# Default: true.
USE_VAULT_OFF := $(shell grep -qiE '^[[:space:]]*USE_VAULT[[:space:]]*=[^a-zA-Z0-9]*(false|0|no|off)[^a-zA-Z0-9]*$$' $(ENV_FILE) 2>/dev/null && echo yes)
ifeq ($(USE_VAULT_OFF),yes)
COMPOSE_FILE := ./docker/docker-compose.yml -f ./docker/docker-compose.novault.yml
endif
BUILD_LOG =		build.log

# User ID and Group ID of the current user on host system
UID =			$(shell id -u)
GID =			$(shell id -g)

# Export user/group IDs to be accessible during image builds and volume
# operations
export UID
export GID

# Enable Docker compose build delegation for better performance
COMPOSE_BAKE =	true
export COMPOSE_BAKE

# Detect if Docker is running in rootless mode:
# 1. Checks if 'docker info' reports "rootless" under Security Options
# 2. Checks if active Docker context endpoint or DOCKER_HOST points to
#    a user socket (/run/user/)
IS_ROOTLESS =	$(shell \
	if docker info 2>/dev/null | grep -qi "rootless"; then echo 1; \
	elif docker context inspect 2>/dev/null | grep -qE "rootless|/run/user/"; \
	then echo 1; \
	elif echo "$$DOCKER_HOST" | grep -qE "rootless|/run/user/"; then echo 1; \
	else echo 0; fi)

# Set SUDO based on Docker mode: empty for rootless mode, sudo for root mode
# (if installed)
ifeq ($(IS_ROOTLESS),1)
SUDO =
else
SUDO =			$(shell command -v sudo >/dev/null 2>&1 && echo sudo)
endif

# ANSI escape codes for colorful messages
RED =			"\e[31m"
GREEN =			"\e[32m"
YELLOW =		"\e[33m"
RESETCOLOR =	"\e[0m"


# **************************************************************************** #
#    CLI ARGUMENTS                                                             #
# **************************************************************************** #

# Allow passing CLI args like: make exec backend-container
ARG_TARGETS = build rebuild exec inspect logs logsf restart stats db-migrate \
db-reset
ifneq ($(filter $(firstword $(MAKECMDGOALS)), $(ARG_TARGETS)), )
ARGS := $(wordlist 2, $(words $(MAKECMDGOALS)), $(MAKECMDGOALS))
$(eval $(ARGS):;@:)
endif
# EXPLANATION:
#
# MAKECMDGOALS is a built-in Make variable containing what is typed after make.
# ARG_TARGETS defines which targets are allowed to receive extra words as args.
#
# $(firstword $(MAKECMDGOALS)) gets the main target only (first word).
# Example: for 'make exec nginx-container', the first word is 'exec'.
# $(filter $(firstword...),$(ARG_TARGETS)) checks if that first target is in
# the allowed list. If it is, uses it as arg1 for the ifneq(arg1,arg2) block.
# In GNU Make conditionals, syntax is: ifneq (arg1,arg2).
# Here arg2 is intentionally empty (after the comma), so we test:
# "is this expression non-empty?". If yes, the block runs.
#
# ARGS := ... takes all words after the first goal and stores them as ARGS.
# Example: "make exec nginx-container" -> ARGS = nginx-container
# $(words $(MAKECMDGOALS)) counts how many words there are in MAKECMDGOALS.
# $(wordlist 2, N, LIST) returns words from position 2 to position N.
#
# $(eval $(ARGS):;@:) creates no-op dummy targets (make rules) for ARGS so Make
# does not fail with: "No rule to make target 'nginx-container'".
# A no-op command is a command that does nothing and succeeds. The no-op command
# used here is '@:': ':' is a shell builtin that does nothing (returns success),
# while '@' hides the command from Make output.
# $(eval ...) evaluates this generated rule at parse time.


# **************************************************************************** #
#    BUILD AND CLEAN COMMANDS                                                  #
# **************************************************************************** #

# Start docker-compose without rebuilding images every time
.PHONY: all
all: env-check ## |Start containers (detached mode)
	@$(SUDO) docker compose -f $(COMPOSE_FILE) up -d
	@DOMAIN_NAME=$$(grep -E '^[[:space:]]*DOMAIN_NAME[[:space:]]*=' \
	$(ENV_FILE) | cut -d '=' -f2 | tr -d ' "'\''\r'); \
	echo "Connect to: https://$${DOMAIN_NAME:-localhost}:8443"

# Start docker-compose without rebuilding images every time (alias for all)
.PHONY: up
up: all ## |Alias for 'make all'

# Build docker-compose images without starting containers
.PHONY: build
build: env-check ## [name]|Build images with cache and log to file
	@$(SUDO) docker compose -f $(COMPOSE_FILE) --progress plain build \
		$(ARGS) 2>&1 | tee $(BUILD_LOG)

# Rebuild docker-compose images (cached) and start containers
.PHONY: up-build
up-build: env-check ## |Rebuild images (cached) and start containers
	@$(SUDO) docker compose -f $(COMPOSE_FILE) up --build -d
	@DOMAIN_NAME=$$(grep -E '^[[:space:]]*DOMAIN_NAME[[:space:]]*=' \
	$(ENV_FILE) | cut -d '=' -f2 | tr -d ' "'\''\r'); \
	echo "Connect to: https://$${DOMAIN_NAME:-localhost}:8443"

# Rebuild images without cache and log output to build.log
.PHONY: rebuild
rebuild: env-check ## [name]|Rebuild images with no-cache and log to file
	@$(SUDO) docker compose -f $(COMPOSE_FILE) --progress plain build \
		$(ARGS) --no-cache 2>&1 | tee $(BUILD_LOG)

# Rebuild docker-compose images (no-cache) and start containers
.PHONY: up-rebuild
up-rebuild: env-check ## |Rebuild images (no-cache) and start containers
	@$(SUDO) docker compose -f $(COMPOSE_FILE) build --no-cache
	@$(SUDO) docker compose -f $(COMPOSE_FILE) up -d
	@DOMAIN_NAME=$$(grep -E '^[[:space:]]*DOMAIN_NAME[[:space:]]*=' \
	$(ENV_FILE) | cut -d '=' -f2 | tr -d ' "'\''\r'); \
	echo "Connect to: https://$${DOMAIN_NAME:-localhost}:8443"

# Stops and removes containers and networks, preserving volumes and images
.PHONY: down
down: ## |Stop and remove containers (keep volumes/data)
	@$(SUDO) docker compose -f $(COMPOSE_FILE) down

# Stops containers without removing them, preserving volumes and images
.PHONY: stop
stop: ## |Stop containers without removing them (keep volumes/data)
	@$(SUDO) docker compose -f $(COMPOSE_FILE) stop

# Rebuild stack from scratch (fclean + all)
.PHONY: re
re: fclean up-rebuild ## |Rebuild stack from scratch (without cache)

# Stops and removes containers, networks, and removes project images
.PHONY: clean
clean: ## |Stop stack and remove project images
	@$(SUDO) docker compose -f $(COMPOSE_FILE) down --rmi all --remove-orphans

# Stops and removes containers, project images, volumes, and build logs
.PHONY: fclean
fclean: clean ## |Clean + remove project volumes and build logs
	@$(SUDO) docker compose -f $(COMPOSE_FILE) down -v --remove-orphans
	@rm -f $(BUILD_LOG)

# Removes only .env file used by this project
.PHONY: clean-env
clean-env: ## |Remove .env file for this project
	@rm -f $(ENV_FILE)
	@echo "Removed $(ENV_FILE)"

# Full local reset: project resources + .env
.PHONY: wipe
wipe: fclean clean-env ## |fclean + remove .env file

# Removes project resources via fclean, then prunes global Docker resources:
# builder cache, stopped containers, unused networks, images (not volumes)
.PHONY: clean-cache
clean-cache: fclean ## |fclean + prune global Docker resources (not volumes)
	@echo "Pruning Docker builder cache (global, not project-scoped)..."
	@$(SUDO) docker builder prune -af

# Runs a full project cleanup first via fclean, then prunes unused Docker
# resources globally on the host: builder cache, stopped containers, unused
# networks, images, and volumes
.PHONY: prune
prune: fclean ## |fclean + prune Docker resources globally on the host
	@echo "Pruning everything o.o"
	@$(SUDO) docker system prune -a --volumes -f
	@$(SUDO) docker volume prune -a -f


# **************************************************************************** #
#    USEFUL DOCKER COMMANDS                                                    #
# **************************************************************************** #

# Starts a shell in the specified container (default: bash/sh) or run a specific
# command in container.
.PHONY: exec
exec: ## <name> [cmd]|Open shell (default: bash/sh) or run cmd in container
	@if [ -z "$(ARGS)" ]; then \
		echo "Usage: make exec <container_name_or_id> [command]"; \
		echo "Example: make exec nginx-container"; \
		echo "Example: make exec backend-container bash"; \
		exit 1; \
	fi; \
	if [ "$$(echo $(ARGS) | wc -w)" -eq 1 ]; then \
		$(SUDO) docker exec -it $(ARGS) bash || \
		$(SUDO) docker exec -it $(ARGS) sh; \
	else \
		$(SUDO) docker exec -it $(ARGS); \
	fi

# Shows all Docker containers (running and stopped)
.PHONY: ps
ps: ## |Show all containers (running and stopped)
	@$(SUDO) docker ps -a

# Shows the status of Docker containers related to this compose project
.PHONY: status
status: ## |Show compose service status
	@$(SUDO) docker compose -f $(COMPOSE_FILE) ps

# Shows metadata about a running container
.PHONY: inspect
inspect: ## <name>|Inspect container metadata
	@if [ -z "$(ARGS)" ]; then \
		echo "Usage: make inspect <container_name_or_id>"; \
		exit 1; \
	fi
	@$(SUDO) docker inspect $(ARGS)

# Shows the logs of one or more running containers
.PHONY: logs
logs: ## [service]|Show compose logs
	@if [ -n "$(ARGS)" ]; then \
		$(SUDO) docker compose -f $(COMPOSE_FILE) logs --tail=100 $(ARGS); \
	else \
		$(SUDO) docker compose -f $(COMPOSE_FILE) logs --tail=100; \
	fi

# Follows containers' logs in real time
.PHONY: logsf
logsf: ## [service]|Follow compose logs in real time
	@if [ -n "$(ARGS)" ]; then \
		$(SUDO) docker compose -f $(COMPOSE_FILE) logs -f --tail=100 $(ARGS); \
	else \
		$(SUDO) docker compose -f $(COMPOSE_FILE) logs -f --tail=100; \
	fi

# Restarts one or more running containers
.PHONY: restart
restart: ## <name> [more...]|Restart one or more containers
	@if [ -z "$(ARGS)" ]; then \
		echo "Usage: make restart <container_name_or_id> [more...]"; \
		exit 1; \
	fi
	@$(SUDO) docker restart $(ARGS)

# List local Docker images
.PHONY: images
images: ## |List local Docker images
	@$(SUDO) docker images

# List Docker volumes
.PHONY: volumes
volumes: ## |List Docker volumes
	@$(SUDO) docker volume ls

# List Docker networks
.PHONY: networks
networks: ## |List Docker networks
	@$(SUDO) docker network ls

# Shows resolved docker-compose configuration
.PHONY: config
config: ## |Print resolved docker-compose configuration
	@$(SUDO) docker compose -f $(COMPOSE_FILE) config

# Shows resource usage of containers
.PHONY: stats
stats: ## [name]|Show one-shot container resource usage
	@if [ -n "$(ARGS)" ]; then \
		$(SUDO) docker stats --no-stream $(ARGS); \
	else \
		$(SUDO) docker stats --no-stream; \
	fi

# Shows Docker disk usage
.PHONY: df
df: ## |Show Docker disk usage summary
	@$(SUDO) docker system df


# **************************************************************************** #
#    DATABASE COMMANDS                                                         #
# **************************************************************************** #

# Macro to execute Prisma commands inside backend container.
# If backend container is running, use 'docker compose exec'.
# If stopped, use 'docker compose run --rm --entrypoint ""'.
define run_prisma
	TTY_OPT=""; \
	if [ ! -t 0 ]; then TTY_OPT="-T"; fi; \
	if [ -n "$$($(SUDO) docker compose -f $(COMPOSE_FILE) ps --status running \
	-q backend 2>/dev/null)" ]; then \
		$(SUDO) docker compose -f $(COMPOSE_FILE) exec $$TTY_OPT backend \
		npx prisma $(1); \
	else \
		$(SUDO) docker compose -f $(COMPOSE_FILE) run --rm $$TTY_OPT \
		--entrypoint "" backend npx prisma $(1); \
	fi
endef

# Creates or applies database migrations (optionally with migration name)
.PHONY: db-migrate
db-migrate: env-check ## [name]|Create or apply database migrations
	@CMD="migrate dev"; \
	if [ -n "$(ARGS)" ]; then \
		CMD="migrate dev --name $(ARGS)"; \
	fi; \
	$(call run_prisma,$$CMD)

# Resets database schema, drops data, reapplies migrations, and seeds
.PHONY: db-reset
db-reset: env-check ## [force]|Reset database and re-seed
	@CMD="migrate reset"; \
	if [ "$(ARGS)" = "force" ]; then \
		CMD="migrate reset --force"; \
	fi; \
	$(call run_prisma,$$CMD)

# Runs idempotent seed script (src/backend/prisma/seed.ts)
.PHONY: db-seed
db-seed: env-check ## |Seed database with initial data
	@$(call run_prisma,db seed)

# Regenerates Prisma Client based on schema.prisma
.PHONY: db-generate
db-generate: env-check ## |Regenerate Prisma Client
	@$(call run_prisma,generate)

# Checks migration status and detects schema drift
.PHONY: db-status
db-status: env-check ## |Check database migration status
	@$(call run_prisma,migrate status)

# Launches Prisma Studio GUI on port 5555
.PHONY: db-studio
db-studio: env-check ## |Launch Prisma Studio GUI on port 5555
	@echo "Opening Prisma Studio at: http://localhost:5555"
	@echo "Press Ctrl+C to stop."
	@TTY_OPT=""; \
	if [ ! -t 0 ]; then TTY_OPT="-T"; fi; \
	if [ -n "$$($(SUDO) docker compose -f $(COMPOSE_FILE) ps --status running \
	-q backend 2>/dev/null)" ]; then \
		$(SUDO) docker compose -f $(COMPOSE_FILE) exec $$TTY_OPT backend node \
		prisma/studio.js; \
	else \
		$(SUDO) docker compose -f $(COMPOSE_FILE) run --rm $$TTY_OPT \
		-p 5555:5555 --entrypoint "" backend node prisma/studio.js; \
	fi

# Squashes all migrations into a single consolidated 'init' migration
.PHONY: db-squash
db-squash: env-check ## |Squash migrations into a single baseline init
	@echo -n $(YELLOW)"WARNING: This will wipe current migrations, reset ";
	@echo "the database, and generate a single 'init' migration."$(RESETCOLOR);
	@printf "Are you sure you want to proceed? [y/N]: "; \
	read confirm; \
	if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
		echo "Aborted."; \
		exit 1; \
	fi; \
	TIMESTAMP=$$(date +%Y%m%d%H%M%S); \
	ARC_DIR="src/backend/prisma/.migrations_archive/migrations_$${TIMESTAMP}"; \
	if [ -d "src/backend/prisma/migrations" ] && \
	[ -n "$$(ls -A src/backend/prisma/migrations 2>/dev/null)" ]; then \
		mkdir -p "$$ARC_DIR" && \
		cp -r src/backend/prisma/migrations/* "$$ARC_DIR/" && \
		echo "Backed up existing migrations to $$ARC_DIR"; \
	fi; \
	rm -rf src/backend/prisma/migrations 2>/dev/null || \
	$(SUDO) rm -rf src/backend/prisma/migrations; \
	mkdir -p "src/backend/prisma/migrations/$${TIMESTAMP}_init"; \
	echo "Generating consolidated initial migration..."; \
	$(call run_prisma,migrate diff --from-empty \
	--to-schema prisma/schema.prisma --script \
	--output prisma/migrations/$${TIMESTAMP}_init/migration.sql); \
	echo "Resetting database schema and applying migration..."; \
	$(call run_prisma,migrate reset --force); \
	$(call run_prisma,db seed); \
	$(call run_prisma,generate); \
	echo -n $(GREEN)"Database successfully squashed into a single 'init' "; \
	echo "migration!"$(RESETCOLOR)


# **************************************************************************** #
#    SETUP AND CHECK COMMANDS                                                  #
# **************************************************************************** #

# Checks whether .env exists, prompts to create from .env.example if missing,
# and validates vars
.PHONY: env-check
env-check: ## |Verify .env exists and required vars are present
	@if [ ! -s "$(ENV_FILE)" ]; then \
		echo "Missing or empty env file: $(ENV_FILE)"; \
		echo "Run 'make env-init' to create it from $(ENV_EXAMPLE)."; \
		exit 1; \
	fi; \
	missing=0; \
	if grep -qiE '^[[:space:]]*USE_VAULT[[:space:]]*=[^a-zA-Z0-9]*(false|0|no|off)[^a-zA-Z0-9]*$$' "$(ENV_FILE)"; then \
		echo "USE_VAULT=false: Vault disabled, secrets are read from $(ENV_FILE)."; \
		mode_vars="DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET COOKIE_SECRET \
		TWO_FACTOR_AUTH"; \
	else \
		mode_vars="ACME_VAULT_ROLE_ID ACME_VAULT_SECRET_ID \
		DATABASE_VAULT_ROLE_ID DATABASE_VAULT_SECRET_ID \
		BACKEND_VAULT_ROLE_ID BACKEND_VAULT_SECRET_ID"; \
	fi; \
	for var in PRODUCTION_FLAG ACME_EMAIL ACME_STAGING DOMAIN_NAME \
	POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB UPLOADS_DIR \
	$$mode_vars; do \
		if ! grep -Eq "^[[:space:]]*$${var}[[:space:]]*=" "$(ENV_FILE)"; then \
			echo "Missing variable in $(ENV_FILE): $$var"; \
			missing=1; \
		fi; \
	done; \
	if [ $$missing -ne 0 ]; then \
		echo -n "Some required variables are missing in $(ENV_FILE)."; \
		echo " Check $(ENV_EXAMPLE)."; \
		exit 1; \
	fi

# Copies .env.example to .env (prompts if .env already exists)
# TODO!
.PHONY: env-init
env-init: ## |Initialize .env from .env.example
	@echo "This feature is not implemented yet!"; \
	echo -n "Manually copy the $(ENV_EXAMPLE) file into "; \
	echo "$(ENV_FILE) and adjust the values."

# Quick project setup rule
.PHONY: setup
setup: env-check all ## |Verify .env and launch the stack


# **************************************************************************** #
#    HELP MESSAGE                                                              #
# **************************************************************************** #

# Shows a help message listing all make commands and their descriptions
.PHONY: help
help: ## |Show this help message
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_.-]+:.*## / { \
		split($$2, part, "|"); \
		args = part[1]; \
		desc = part[2]; \
		cmd = "make " $$1; \
		if (args != "") cmd = cmd " " args; \
		printf "  %-30s %s\n", cmd, desc \
	}' Makefile
	@echo ""
	@echo "Notes:"
	@echo "  - Docker mode:" \
	"$(if $(filter 1,$(IS_ROOTLESS)),rootless (no sudo),root (sudo=$(SUDO)))"
	@echo "  - Run: make exec <name> [cmd], make inspect <name>," \
	"make logs [service]."
