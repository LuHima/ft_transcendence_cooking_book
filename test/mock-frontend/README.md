# Mock Frontend

Semplice frontend statico per testare le API del backend.

Avvio rapido (se usi il docker-compose alternativo):

```bash
# dalla root del progetto
docker compose -f docker/docker-compose.mock-frontend.yml up --build mock-frontend
```

Oppure per testare localmente:

```bash
python3 -m http.server 5173 --directory mock-frontend
# poi apri http://localhost:5173
```
