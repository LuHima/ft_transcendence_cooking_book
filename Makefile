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
#    MAIN RULES                                                                #
# **************************************************************************** #

# Default target: check if Vault needs unsealing, then launch the stack
.PHONY: all
all: env-check ## |Launch containers (unsealing Vault automatically if sealed)
	@if [ "$(USE_VAULT_OFF)" != "yes" ]; then \
		$(MAKE) vault-unseal; \
	fi
	@$(MAKE) up

# Starts the containers in detached mode using compose file(s)
.PHONY: up
up: ## |Start containers in detached mode
	@docker compose -f $(COMPOSE_FILE) up -d

# Development mode: combines base compose with dev override (live reload +
# debug ports 5432 and 5555 + Let's Encrypt staging).
.PHONY: dev
dev: env-check ## |Launch stack with live reload, staging TLS, and debug ports
	@if [ "$(USE_VAULT_OFF)" != "yes" ]; then \
		$(MAKE) vault-unseal; \
	fi
	@COMPOSE_DEV="./docker/docker-compose.yml -f ./docker/docker-compose.dev.yml"; \
	if [ "$(USE_VAULT_OFF)" = "yes" ]; then \
		COMPOSE_DEV="$$COMPOSE_DEV -f ./docker/docker-compose.novault.yml"; \
	fi; \
	docker compose -f $$COMPOSE_DEV up -d

# Production mode: launches hardened base compose without dev bind mounts or
# exposed database ports.
.PHONY: prod
prod: env-check ## |Launch hardened production stack
	@if [ "$(USE_VAULT_OFF)" != "yes" ]; then \
		$(MAKE) vault-unseal; \
	fi
	@docker compose -f ./docker/docker-compose.yml up -d

# Stops the running containers without removing them
.PHONY: stop
stop: ## |Stop all running containers
	@docker compose -f $(COMPOSE_FILE) stop

# Stops and removes containers, networks, and images created by up
.PHONY: down
down: ## |Stop and remove containers, networks, and images
	@docker compose -f $(COMPOSE_FILE) down

# Full restart: shuts down everything, then brings it back up
.PHONY: restart
restart: down all ## |Restart the entire stack

# Rebuilds Docker images and restarts containers in detached mode
.PHONY: re
re: down ## |Rebuild all Docker images and restart containers
	@docker compose -f $(COMPOSE_FILE) up -d --build

# Removes all stopped containers, unused networks, and dangling images
.PHONY: clean
clean: ## |Remove stopped containers and dangling images
	@docker system prune -f

# Complete cleanup: removes all images, volumes, and build cache
.PHONY: fclean
fclean: ## |Remove all images, volumes, and persistent data
	@docker compose -f $(COMPOSE_FILE) down -v --rmi all
	@docker system prune -a --volumes -f

# **************************************************************************** #
#    VAULT LIFECYCLE                                                           #
# **************************************************************************** #

# One-time initialization of HashiCorp Vault. Starts the vault container,
# checks if uninitialized; if so, runs 'vault operator init' with 5 shares
# and threshold 3, saves keys to $HOME/vault-keys/vault-init.txt (mode 600),
# unseals temporarily to configure AppRole and secrets, and writes AppRole
# credentials into docker/.env.
.PHONY: vault-init
vault-init: env-check ## |One-time automated Vault bootstrap and AppRole setup
	@./vault-setup.sh

# Unseals Vault with 3-tier key resolution:
#   1. CLI arguments: make vault-unseal k1 k2 k3
#   2. Environment: VAULT_UNSEAL_KEY_1..3 in docker/.env
#   3. Interactive prompt: prompts for missing keys with masked input
# If Vault is already unsealed or not running, exits cleanly (no-op).
.PHONY: vault-unseal
vault-unseal: ## [k1 k2 k3]|Unseal Vault via CLI args, .env keys, or interactive prompt
	@./unseal.sh $(filter-out $@,$(MAKECMDGOALS))

# Catch-all rule so positional arguments to vault-unseal (e.g. k1 k2 k3)
# are not treated as missing Makefile targets.
%:
	@:

# **************************************************************************** #
#    API & POSTMAN SYNCHRONIZATION                                             #
# **************************************************************************** #

.PHONY: openapi-generate
openapi-generate: ## |Generate headless OpenAPI 3.0 specification
	@echo $(YELLOW)"Generating headless OpenAPI specification..."$(RESETCOLOR)
	@npm run openapi:generate

.PHONY: postman-sync
postman-sync: openapi-generate ## |Synchronize Postman specification and collection
	@echo $(YELLOW)"Synchronizing Postman specification and collection..."$(RESETCOLOR)
	@npm run postman:sync

# **************************************************************************** #
#    INSPECTION & UTILITIES                                                    #
# **************************************************************************** #

.PHONY: status
status: ## |Show container status, health, and port mappings
	@docker compose -f $(COMPOSE_FILE) ps -a

.PHONY: logs
logs: ## [service]|Follow container logs (optionally for a specific service)
	@docker compose -f $(COMPOSE_FILE) logs -f $(filter-out $@,$(MAKECMDGOALS))

.PHONY: top
top: ## |Display running processes across all containers
	@docker compose -f $(COMPOSE_FILE) top

# **************************************************************************** #
#    SETUP & VALIDATION                                                        #
# **************************************************************************** #

.PHONY: env-check
env-check:
	@if [ ! -f "$(ENV_FILE)" ]; then \
		echo "Environment file $(ENV_FILE) not found. Create it from $(ENV_EXAMPLE)."; \
		exit 1; \
	fi

.PHONY: setup
setup: env-check all ## |Verify .env and launch the stack

# **************************************************************************** #
#    HELP MESSAGE                                                              #
# **************************************************************************** #

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
	@echo "  - Docker mode: $(if $(filter 1,$(IS_ROOTLESS)),rootless (no sudo),root (sudo=$(SUDO)))"
