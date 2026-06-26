NAME = netsjs

SUDO = sudo

RED := \e[31m
GREEN := \e[32m
RESET := \e[0m

# la versione dei PC della scuola è 2.36.2
all: $(NAME)

$(NAME):
	$(SUDO) docker compose up --build
#	$(MAKE) in_backend

frontend:
	$(SUDO) docker compose up --build

backend:
	$(SUDO) docker compose up --build

ps:
	$(SUDO) docker compose ps

stop:
	$(SUDO) docker compose down

prune:
	$(SUDO) docker container prune -f

in_backend:
	$(SUDO) docker exec -it backend-container bash
