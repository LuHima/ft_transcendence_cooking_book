.PHONY: up down build

COMPOSE_FILE=./docker-compose.mock-frontend.yml

up:
	docker compose -f $(COMPOSE_FILE) up --build

down:
	docker compose -f $(COMPOSE_FILE) down

build:
	docker compose -f $(COMPOSE_FILE) build

prune:
	$(SUDO) docker container prune -f

in_backend:
	$(SUDO) docker exec -it backend-container bash

fclean: down prune

re: fclean up