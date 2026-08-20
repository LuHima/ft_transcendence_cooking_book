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
	$(SUDO) docker system prune -a --volumes -f

stats_memory:
	docker system df



in_backend:
	$(SUDO) docker exec -it backend-container bash

fclean: down prune

re: fclean all


# nest g module "name" crea una cartella con quel module nome 
# $ nest g module "name"
# $ nest g controller "name" crea il file controller 
# $ nest g service "name" crea il service
