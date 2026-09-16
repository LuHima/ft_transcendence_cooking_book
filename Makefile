# **************************************************************************** #
#    GENERAL INFO                                                              #
# **************************************************************************** #

# Name of the project
NAME =			WeCook

# Docker compose file and environment configuration paths
COMPOSE_FILE =	./docker/docker-compose.yml
ENV_FILE =		./docker/.env
ENV_EXAMPLE =	./docker/.env.example
BUILD_LOG =		build.log

# User ID and Group ID of the current user on host system
UID =			$(shell id -u)
GID =			$(shell id -g)

# Export user/group IDs to be accessible during image builds and volume
# operations
export UID
export GID

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
ARG_TARGETS = exec inspect logs logsf restart stats
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

# Build docker-compose images without starting containers
.PHONY: build
build: env-check ## |Build images without starting containers
	@$(SUDO) docker compose -f $(COMPOSE_FILE) build

# Rebuild docker-compose images (cached) and start containers
.PHONY: up-build
up-build: env-check ## |Rebuild images and start containers (cached)
	@$(SUDO) docker compose -f $(COMPOSE_FILE) up --build -d

# Rebuild images without cache and log output to build.log
.PHONY: rebuild
rebuild: env-check ## |Rebuild images with no-cache and log to file
	@$(SUDO) docker compose -f $(COMPOSE_FILE) --progress plain build \
		--no-cache 2>&1 | tee $(BUILD_LOG)

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
re: fclean all ## |Rebuild stack from scratch

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

# Removes project resources and prunes global Docker builder cache
.PHONY: clean-cache
clean-cache: wipe ## |Remove project resources and global builder cache
	@echo "Pruning Docker builder cache (global, not project-scoped)..."
	@$(SUDO) docker builder prune -af

# Runs a full project cleanup first via wipe, then prunes unused Docker
# resources globally on the host: stopped containers, unused networks,
# images, and volumes
.PHONY: prune
prune: wipe ## |Prune Docker resources globally on the host
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
	for var in DOMAIN_NAME POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET COOKIE_SECRET; do \
		if ! grep -Eq "^[[:space:]]*$${var}[[:space:]]*=" "$(ENV_FILE)"; then \
			echo "Missing variable in $(ENV_FILE): $$var"; \
			missing=1; \
		fi; \
	done; \
	if [ $$missing -ne 0 ]; then \
		echo "Some required variables are missing in $(ENV_FILE). Check $(ENV_EXAMPLE)."; \
		exit 1; \
	fi

# Copies .env.example to .env (prompts if .env already exists)
# TODO!
.PHONY: env-init
env-init: ## |Initialize .env from .env.example
	@echo "This feature is not implemented yet!"; \
	echo "Manually copy the $(ENV_EXAMPLE) file into $(ENV_FILE) and adjust the values."

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
		printf "  %-35s %s\n", cmd, desc \
	}' Makefile
	@echo ""
	@echo "Notes:"
	@echo "  - Docker mode: $(if $(filter 1,$(IS_ROOTLESS)),rootless (no sudo),root (SUDO=$(SUDO)))"
	@echo "  - Run: make exec <name> [cmd], make inspect <name>, make logs [service]."
