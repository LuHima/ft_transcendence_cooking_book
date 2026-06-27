NAME = netsjs

PATH_DOCKER_COMPOSE= ./docker/docker-compose.yml

PATH_EXE= -f  $(PATH_DOCKER_COMPOSE)

RED := \e[31m
GREEN := \e[32m
RESET := \e[0m

# la versione dei PC della scuola è 2.36.2
all: $(NAME)

$(NAME):
	$(SUDO) docker compose $(PATH_EXE)  up --build
#	$(MAKE) in_backend

ps:
	$(SUDO) docker compose $(PATH_EXE) ps

down:
	$(SUDO) docker compose $(PATH_EXE) down

prune:
	$(SUDO) docker container prune -f

in_backend:
	$(SUDO) docker exec -it backend-container bash
