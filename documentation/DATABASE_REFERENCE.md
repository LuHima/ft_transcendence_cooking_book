# Database — Recipe Sharing Platform
### Guida di riferimento completa (Prisma 7 + PostgreSQL + Docker)

---

## Indice
1. [Stack e struttura file](#1-stack-e-struttura-file)
2. [Avvio rapido — ogni volta che ricominci a lavorare](#2-avvio-rapido)
3. [Comandi essenziali](#3-comandi-essenziali)
4. [Schema del database — tutte le tabelle spiegate](#4-schema-del-database)
5. [Regole di business implementate nello schema](#5-regole-di-business)
6. [Come funziona il seed](#6-come-funziona-il-seed)
7. [Prisma Studio — interfaccia grafica](#7-prisma-studio)
8. [Come modificare lo schema](#8-come-modificare-lo-schema)
9. [Git — cosa committare e cosa no](#9-git)
10. [Come il backend userà questo database](#10-integrazione-con-il-backend)
11. [Docker Compose — deployment finale ft_transcendence](#11-docker-compose)
12. [Errori comuni e soluzioni](#12-errori-comuni)

---

## 1. Stack e struttura file

**Tecnologie usate:**
- **PostgreSQL 16** — il database relazionale, gira dentro un container Docker
- **Prisma 7** — ORM che traduce TypeScript ↔ SQL
- **Docker** — isola Postgres senza installarlo sul sistema

**Struttura della cartella `database/`:**
```
database/
├── prisma/
│   ├── schema.prisma        ← definizione di tutte le tabelle e relazioni
│   ├── migrations/          ← SQL generato automaticamente da Prisma (non toccare)
│   │   └── 20260630164740_init/
│   │       └── migration.sql
│   └── seed.ts              ← script per popolare il DB con dati di prova
├── generated/
│   └── prisma/              ← client TypeScript generato da Prisma (non toccare)
├── prisma.config.ts         ← configurazione Prisma 7 (carica .env, imposta path)
├── package.json
├── tsconfig.json
├── .env                     ← credenziali DB (NON va su Git)
└── .env.example             ← template .env senza dati sensibili (va su Git)
```

---

## 2. Avvio rapido

**Ogni volta che ricominci a lavorare sul database**, fai questi comandi in ordine:

```bash
# 1. Vai nella cartella giusta
cd ~/Desktop/ft_transcendence/database

# 2. Controlla se Postgres è già in esecuzione
docker ps

# 3a. Se NON vedi recipe-db nella lista, avvialo
docker start recipe-db

# 3b. Se il container non esiste proprio (prima volta o dopo docker rm)
docker run --name recipe-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=recipe_platform \
  -p 5432:5432 \
  -d postgres:16

# 4. Verifica che tutto funzioni aprendo Prisma Studio
npx prisma studio
# apri http://localhost:5555 nel browser
# Ctrl+C per chiuderlo
```

---

## 3. Comandi essenziali

### Prisma

| Comando | Cosa fa |
|---|---|
| `npx prisma migrate dev --name nome` | Crea e applica una nuova migrazione (dopo aver modificato schema.prisma) |
| `npx prisma migrate deploy` | Applica migrazioni pendenti (usato in produzione/Docker) |
| `npx prisma generate` | Rigenera il client TypeScript in `generated/prisma/` |
| `npx prisma studio` | Apre l'interfaccia grafica sul browser (localhost:5555) |
| `npx prisma migrate reset` | ⚠️ Cancella TUTTO il DB e riapplica da zero (utile in sviluppo) |

### Seed

```bash
# Popola il DB con dati di prova
npx ts-node prisma/seed.ts
```

### Docker

| Comando | Cosa fa |
|---|---|
| `docker ps` | Mostra i container attivi |
| `docker start recipe-db` | Avvia il container Postgres (se esiste già) |
| `docker stop recipe-db` | Ferma il container Postgres |
| `docker rm recipe-db` | Elimina il container (i dati nel volume restano) |
| `docker logs recipe-db` | Mostra i log di Postgres (utile per debug) |

---

## 4. Schema del database

Il database ha **10 tabelle**. Ecco cosa contiene ognuna e perché esiste.

### `users` — Utenti della piattaforma

```
id            → identificativo univoco
username      → nome utente (max 30 caratteri, unico)
email         → email (unica)
password_hash → password hashata con bcrypt (mai in chiaro)
avatar_url    → URL dell'immagine profilo (opzionale)
is_active     → true = utente attivo, false = utente eliminato
deleted_at    → data di eliminazione (NULL se attivo)
created_at    → data di registrazione
```

**Nota importante:** quando un utente elimina il proprio account, NON viene cancellato fisicamente dalla tabella. Viene impostato `is_active = false` e `deleted_at = ora`. Questo si chiama **soft delete**.

---

### `recipes` — Ricette

```
id           → identificativo univoco
user_id      → chi ha creato la ricetta (NULL se l'utente è stato eliminato)
owner_type   → 'user' = ricetta dell'utente | 'platform' = ricetta della piattaforma
title        → titolo (max 255 caratteri)
description  → descrizione breve (opzionale)
instructions → istruzioni di preparazione (opzionale)

prep_time    → tempo di preparazione in minuti (opzionale)
created_at   → data di creazione
recipe_media → foto e video della ricetta
```

**Nota:** `user_id` può essere NULL. Quando un utente elimina il proprio account, le sue ricette non vengono cancellate: `user_id` diventa NULL e `owner_type` diventa `'platform'`. In questo modo la ricetta resta visibile sul sito ma appare come "di dominio della piattaforma".

---

### `ingredients` — Ingredienti (catalogo globale)

```
id   → identificativo univoco
name → nome dell'ingrediente (unico, es. "Pasta", "Pomodoro")
```

Gli ingredienti sono condivisi tra tutte le ricette. Se due ricette usano "Pasta", puntano entrambe allo stesso record in questa tabella.

---

### `recipe_ingredients` — Ingredienti di una ricetta

```
recipe_id     → quale ricetta
ingredient_id → quale ingrediente
quantity      → quantità (es. 320)
unit          → unità di misura (es. "g", "ml", "pz")
```

Tabella di giunzione tra `recipes` e `ingredients`. La chiave primaria è la coppia `(recipe_id, ingredient_id)` — un ingrediente non può comparire due volte nella stessa ricetta.

---

### `comments` — Commenti e risposte

```
id         → identificativo univoco
recipe_id  → a quale ricetta appartiene il commento
user_id    → chi ha scritto (NULL se l'utente è stato eliminato)
parent_id  → NULL = commento principale | ID = risposta a quel commento
content    → testo del commento
is_active  → true = visibile, false = eliminato
created_at → data di scrittura
```

**Struttura ad albero:** i commenti principali hanno `parent_id = NULL`. Le risposte hanno `parent_id` valorizzato con l'ID del commento padre. Un solo livello di annidamento: le risposte non possono avere risposte.

**Regola di business:** se si elimina un commento principale che ha risposte, si eliminano anche tutte le risposte. Questa logica va implementata nel backend (non nel DB).

---

### `likes` — Like alle ricette

```
user_id    → chi ha messo like
recipe_id  → a quale ricetta
created_at → quando
```

La chiave primaria è la coppia `(user_id, recipe_id)` — un utente può mettere like a una ricetta una sola volta.

---

### `meal_plans` — Piani pasto settimanali

```
id         → identificativo univoco
user_id    → a chi appartiene il piano
start_date → data di inizio (es. lunedì)
end_date   → data di fine (es. domenica)
created_at → data di creazione
```

---

### `meal_plan_recipes` — Ricette nel piano pasto

```
meal_plan_id → quale piano pasto
recipe_id    → quale ricetta
planned_date → per quale giorno (es. 2026-06-23)
meal_type    → 'breakfast' | 'lunch' | 'dinner' | 'snack'
```

La chiave primaria è la tripla `(meal_plan_id, recipe_id, planned_date)`.

---

### `shopping_lists` — Liste della spesa

```
id           → identificativo univoco
user_id      → a chi appartiene
meal_plan_id → collegata a quale piano pasto (opzionale)
created_at   → data di creazione
```

---

### `shopping_list_items` — Articoli nella lista della spesa

```
id               → identificativo univoco
shopping_list_id → a quale lista appartiene
ingredient_id    → quale ingrediente
quantity         → quantità
unit             → unità di misura
checked          → false = da comprare | true = già nel carrello
```

---

## 5. Regole di business

Queste sono le logiche speciali del progetto e come sono implementate.

### Eliminazione account utente

**Non si usa `DELETE`** sul record utente. Si fa invece:

```
1. recipe.updateMany  → user_id = NULL, owner_type = 'platform'  (ricette → piattaforma)
2. comment.updateMany → user_id = NULL                           (commenti → anonimi)
3. user.update        → is_active = false, deleted_at = now()    (soft delete)
```

Tutto dentro una `$transaction` per garantire atomicità (o tutto va a buon fine, o niente).

**Perché non CASCADE nel DB?** Perché con CASCADE il DB cancellerebbe automaticamente ricette e commenti quando si cancella l'utente. Noi invece vogliamo *preservarli* — le ricette diventano della piattaforma, i commenti restano anonimi.

### Eliminazione commento con risposte

```
1. Se il commento ha replies → comment.deleteMany({ where: { parent_id: commentId } })
2. Poi → comment.delete({ where: { id: commentId } })
```

Anche questa logica va nel backend (service layer), non nel DB.

### Utenti non autenticati

Possono solo leggere ricette e commenti. Questa restrizione non è nel database ma nel backend (guard sulle API).

### CASCADE presenti nel DB (quelli "sicuri")

Questi invece sono gestiti direttamente dal database con `onDelete: Cascade`:

| Se elimini... | Si eliminano automaticamente anche... |
|---|---|
| Una ricetta | I suoi `recipe_ingredients`, `comments`, `likes`, `meal_plan_recipes` |
| Un meal plan | I suoi `meal_plan_recipes` |
| Una shopping list | I suoi `shopping_list_items` |
| Un utente (CASCADE) | Le sue `shopping_lists`, `meal_plans`, `likes` |

---

## 6. Come funziona il seed

Il file `prisma/seed.ts` è uno script che popola il database con dati finti per testare che tutto funzioni. **Non è codice del prodotto finale** — serve solo durante lo sviluppo.

Crea:
- 2 utenti con password `password123`
- 6 ingredienti
- 2 ricette con ingredienti collegati
- 3 commenti (di cui 1 risposta a un commento)
- 2 like
- 1 meal plan con 2 ricette pianificate
- 1 shopping list con 6 articoli

**Per resettare il DB e rifarlo da zero:**
```bash
npx prisma migrate reset   # cancella tutto e riapplica le migrazioni
npx ts-node prisma/seed.ts # ripopola con i dati di prova
```

---

## 7. Prisma Studio

Interfaccia grafica per esplorare e modificare i dati del database dal browser.

```bash
npx prisma studio
# si apre su http://localhost:5555
# Ctrl+C per chiuderlo
```

**Cosa puoi fare:**
- Vedere tutti i dati tabella per tabella
- Filtrare e cercare record
- Aggiungere, modificare, cancellare record manualmente
- Navigare le relazioni (clicca su un ID per vedere il record collegato)

**Utile per:** verificare che il seed abbia funzionato, testare manualmente le relazioni, debuggare durante lo sviluppo.

---

## 8. Come modificare lo schema

Se devi aggiungere una colonna, una tabella, o cambiare una relazione:

```bash
# 1. Modifica prisma/schema.prisma con il tuo editor

# 2. Crea e applica la migrazione
npx prisma migrate dev --name descrizione_della_modifica
# esempio: npx prisma migrate dev --name add_rating_to_recipes

# 3. Rigenera il client TypeScript
npx prisma generate
```

**Importante:** ogni modifica allo schema genera un nuovo file SQL in `prisma/migrations/`. Questi file vanno **sempre committati su Git** — servono al backend per aggiornare il database in produzione.

---

## 9. Git

### File da committare ✅
```
prisma/schema.prisma
prisma/migrations/        (tutta la cartella)
prisma/seed.ts
prisma.config.ts
package.json
tsconfig.json
.env.example              (senza dati sensibili reali)
```

### File da NON committare ❌
```
.env                      (contiene password del DB)
node_modules/             (troppo pesante, si rigenera con npm install)
generated/                (si rigenera con npx prisma generate)
```

Verifica che `.gitignore` contenga:
```
node_modules/
.env
generated/
```

---

## 10. Integrazione con il backend

Il team backend (NestJS) userà questo stesso schema. Ecco cosa devono fare:

```bash
# Nel loro progetto NestJS, installano il client Prisma
npm install @prisma/client @prisma/adapter-pg pg

# Copiano prisma/schema.prisma nel loro progetto
# Generano il client
npx prisma generate

# Per applicare le migrazioni in produzione (non migrate dev)
npx prisma migrate deploy
```

**Come importano il client nel codice NestJS:**

```typescript
// prisma.service.ts
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

**Esempio di query che faranno:**

```typescript
// Tutte le ricette con autore e numero di like
const recipes = await prisma.recipe.findMany({
  include: {
    user: { select: { username: true, avatar_url: true } },
    _count: { select: { likes: true, comments: true } }
  }
});

// Ricetta singola con ingredienti e commenti
const recipe = await prisma.recipe.findUnique({
  where: { id: recipeId },
  include: {
    recipe_ingredients: { include: { ingredient: true } },
    comments: {
      where: { parent_id: null },   // solo commenti principali
      include: { replies: true, user: { select: { username: true } } }
    }
  }
});
```

---

## 11. Docker Compose — deployment finale ft_transcendence

Quando il progetto sarà completo, Postgres non girerà più con `docker run` manuale ma dentro un `docker-compose.yml` condiviso con frontend e backend. Il pezzo relativo al database:

```yaml
services:
  db:
    image: postgres:16
    container_name: recipe_db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - backend_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db_data:

networks:
  backend_net:
```

Il backend aspetterà che il DB sia pronto (healthcheck) prima di avviare le migrazioni con `npx prisma migrate deploy`.

---

## 12. Errori comuni e soluzioni

### `zsh: command not found: docker`
Docker Desktop non è installato o non è avviato. Aprilo dalle Applicazioni Mac e aspetta che l'icona della balena nella barra menu smetta di animarsi.

### `Error: connect ECONNREFUSED 127.0.0.1:5432`
Postgres non è in esecuzione. Lancia `docker start recipe-db`.

### `Cannot find module '../generated/prisma/client'`
Il client non è stato generato. Lancia `npx prisma generate`.

### `Error: P1012 - url is no longer supported in schema files`
Stai usando Prisma 7 con la sintassi v5. Rimuovi la riga `url = env("DATABASE_URL")` dal blocco `datasource` in `schema.prisma` — la URL va solo in `prisma.config.ts`.

### `TSError: Expected 1 arguments, but got 0` su `new PrismaClient()`
In Prisma 7 il costruttore richiede un adapter. Usa:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
const prisma = new PrismaClient({ adapter });
```

### `Seed completato!` ma le tabelle sono vuote in Prisma Studio
Aggiorna la pagina del browser. Prisma Studio non si aggiorna automaticamente.

### `Error: Unique constraint failed`
Stai eseguendo il seed su un DB già popolato. O usi `upsert` (già fatto nel seed per utenti e ingredienti) oppure resetti il DB prima:
```bash
npx prisma migrate reset
npx ts-node prisma/seed.ts
```
