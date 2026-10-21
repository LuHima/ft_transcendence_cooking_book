#!/bin/sh
# vault-setup.sh - one-shot Vault bootstrap for a fresh machine.
#
# Vault's data lives in the Docker volume `vault_data`, which is local to
# each machine and is NOT part of the Git repo. On a new computer Vault
# starts empty: not initialized, no policies, no roles, no secrets.
# This script rebuilds all of that.
#
# What it does (in order):
#   1. Starts the vault container if it is not running.
#   2. Initializes Vault (5 key shares, threshold 3) and unseals it.
#      The init output (unseal keys + root token) is saved OUTSIDE the
#      repo, in $VAULT_KEYS_DIR (default: ~/vault-keys), and never printed.
#   3. Enables the KV v2 secrets engine at secret/ and the AppRole auth.
#   4. Writes one policy per service (least privilege: read-only on its
#      own path and nothing else).
#   5. Creates one AppRole per service: acme-role, database-role, backend-role.
#   6. Stores the secrets in Vault, reading them from docker/.env when
#      present, otherwise generating random ones for the backend.
#   7. Generates role_id / secret_id for each role and writes them into
#      docker/.env (ACME_*, DATABASE_*, BACKEND_*_VAULT_*).
#
# USAGE (from the repo root, same folder as the Makefile):
#   ./vault-setup.sh
#
# If Vault is already initialized and unsealed, export the root token first:
#   VAULT_ROOT_TOKEN=hvs.xxxx ./vault-setup.sh

set -eu

VAULT_CONTAINER="${VAULT_CONTAINER:-vault-container}"
COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-docker/.env}"
ENV_EXAMPLE="${ENV_EXAMPLE:-docker/.env.example}"
KEYS_DIR="${VAULT_KEYS_DIR:-$HOME/vault-keys}"
KEYS_FILE="${KEYS_DIR}/vault-init.txt"
VAULT_ADDR_LOCAL="http://127.0.0.1:8200"
ROOT_TOKEN="${VAULT_ROOT_TOKEN:-}"

step() { printf '\n=== %s ===\n' "$*"; }
log()  { printf '%s\n' "$*"; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Run a vault command inside the container (no stdin / with stdin).
vexec() {
	docker exec -e VAULT_ADDR="$VAULT_ADDR_LOCAL" -e VAULT_TOKEN="$ROOT_TOKEN" \
		"$VAULT_CONTAINER" vault "$@" </dev/null
}
vexec_in() {
	docker exec -i -e VAULT_ADDR="$VAULT_ADDR_LOCAL" -e VAULT_TOKEN="$ROOT_TOKEN" \
		"$VAULT_CONTAINER" vault "$@"
}

# Read a field ("Initialized" or "Sealed") from `vault status`.
vault_status_field() {
	docker exec -e VAULT_ADDR="$VAULT_ADDR_LOCAL" "$VAULT_CONTAINER" \
		vault status 2>/dev/null </dev/null | awk -v f="$1" '$1==f {print $2}'
}

# Read KEY from the .env file (ignores commented lines, strips quotes/spaces).
get_env_var() {
	[ -f "$ENV_FILE" ] || return 0
	grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | head -n 1 \
		| sed -e 's/^[^=]*=//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
			-e 's/^"//' -e 's/"$//' || true
}

# Set KEY="VALUE" in the .env file (replace if present, append otherwise).
set_env_var() {
	_tmp="$(mktemp)"
	awk -v k="$1" -v v="$2" '
		BEGIN { FS = "="; found = 0 }
		$1 == k { print k "=\"" v "\""; found = 1; next }
		{ print }
		END { if (!found) print k "=\"" v "\"" }
	' "$ENV_FILE" > "$_tmp"
	cat "$_tmp" > "$ENV_FILE"
	rm -f "$_tmp"
}

# 64 hex chars of randomness, no external dependency besides coreutils.
gen_secret() {
	head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
}

# ---------------------------------------------------------------------------
step "Pre-flight checks"
# ---------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || die "docker not found."

if docker compose version >/dev/null 2>&1; then
	DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
	DC="docker-compose"
else
	die "neither 'docker compose' nor 'docker-compose' is available."
fi

[ -f "$COMPOSE_FILE" ] || die "$COMPOSE_FILE not found. Run this from the repo root."

if [ ! -f "$ENV_FILE" ]; then
	[ -f "$ENV_EXAMPLE" ] || die "$ENV_FILE is missing and there is no $ENV_EXAMPLE to copy."
	cp "$ENV_EXAMPLE" "$ENV_FILE"
	log "Created $ENV_FILE from $ENV_EXAMPLE."
fi

# ---------------------------------------------------------------------------
step "Starting the vault container"
# ---------------------------------------------------------------------------
if ! docker ps --format '{{.Names}}' | grep -qx "$VAULT_CONTAINER"; then
	$DC -f "$COMPOSE_FILE" up -d --build vault
else
	log "$VAULT_CONTAINER is already running."
fi

log "Waiting for the Vault API..."
INITIALIZED=""
i=0
while [ "$i" -lt 30 ]; do
	INITIALIZED="$(vault_status_field Initialized || true)"
	[ -n "$INITIALIZED" ] && break
	i=$((i + 1))
	sleep 1
done
[ -n "$INITIALIZED" ] || die "Vault did not answer within 30s. Check: docker logs $VAULT_CONTAINER"

# ---------------------------------------------------------------------------
step "Initialize and unseal"
# ---------------------------------------------------------------------------
if [ "$INITIALIZED" = "false" ]; then
	log "Vault is not initialized: running 'vault operator init' (5 shares, threshold 3)."
	INIT_OUT="$(docker exec -e VAULT_ADDR="$VAULT_ADDR_LOCAL" "$VAULT_CONTAINER" \
		vault operator init -key-shares=5 -key-threshold=3 </dev/null)"

	umask 077
	mkdir -p "$KEYS_DIR"
	chmod 700 "$KEYS_DIR"
	if [ -f "$KEYS_FILE" ]; then
		mv "$KEYS_FILE" "${KEYS_FILE}.old.$(date +%s)"
	fi
	printf '%s\n' "$INIT_OUT" > "$KEYS_FILE"
	chmod 600 "$KEYS_FILE"
	log "Unseal keys and root token saved to: $KEYS_FILE"
	log "Keep that file OUTSIDE the repo and share the keys among team members."

	ROOT_TOKEN="$(printf '%s\n' "$INIT_OUT" | awk '/^Initial Root Token:/ {print $4}')"
	[ -n "$ROOT_TOKEN" ] || die "could not parse the root token from the init output."

	for n in 1 2 3; do
		KEY="$(printf '%s\n' "$INIT_OUT" \
			| awk -v n="$n" '$1=="Unseal" && $2=="Key" && $3==n":" {print $4}')"
		[ -n "$KEY" ] || die "could not parse unseal key $n."
		docker exec -e VAULT_ADDR="$VAULT_ADDR_LOCAL" "$VAULT_CONTAINER" \
			vault operator unseal "$KEY" </dev/null >/dev/null
	done
	log "Vault unsealed."
else
	SEALED="$(vault_status_field Sealed || true)"
	if [ "$SEALED" = "true" ]; then
		die "Vault is initialized but sealed. Run ./unseal.sh <key1> <key2> <key3>, then run this script again."
	fi
	log "Vault is already initialized and unsealed."
	if [ -z "$ROOT_TOKEN" ] && [ -f "$KEYS_FILE" ]; then
		ROOT_TOKEN="$(awk '/^Initial Root Token:/ {print $4}' "$KEYS_FILE")"
	fi
	[ -n "$ROOT_TOKEN" ] || die "need the root token: run 'VAULT_ROOT_TOKEN=hvs.xxx ./vault-setup.sh'."
fi

# ---------------------------------------------------------------------------
step "Enable KV v2 (secret/) and AppRole auth"
# ---------------------------------------------------------------------------
if ! vexec secrets list | grep -q '^secret/'; then
	vexec secrets enable -path=secret kv-v2 >/dev/null
	log "KV v2 enabled at secret/."
else
	log "KV already enabled at secret/."
fi

if ! vexec auth list | grep -q '^approle/'; then
	vexec auth enable approle >/dev/null
	log "AppRole auth enabled."
else
	log "AppRole auth already enabled."
fi

# ---------------------------------------------------------------------------
step "Policies (read-only, one path per service)"
# ---------------------------------------------------------------------------
vexec_in policy write acme-policy - >/dev/null <<'EOF'
path "secret/data/acme" {
  capabilities = ["read"]
}
EOF

vexec_in policy write database-policy - >/dev/null <<'EOF'
path "secret/data/database" {
  capabilities = ["read"]
}
EOF

vexec_in policy write backend-policy - >/dev/null <<'EOF'
path "secret/data/backend" {
  capabilities = ["read"]
}
EOF
log "acme-policy, database-policy, backend-policy written."

# ---------------------------------------------------------------------------
step "AppRoles"
# ---------------------------------------------------------------------------
for svc in acme database backend; do
	vexec write "auth/approle/role/${svc}-role" \
		token_policies="${svc}-policy" token_ttl=1h token_max_ttl=4h >/dev/null
	log "${svc}-role created (policy: ${svc}-policy)."
done

# ---------------------------------------------------------------------------
step "Secrets"
# ---------------------------------------------------------------------------

# Secret per il database: la password Postgres.
PG_PASS="$(get_env_var POSTGRES_PASSWORD)"
[ -n "$PG_PASS" ] || die "POSTGRES_PASSWORD is missing in $ENV_FILE."
vexec kv put secret/database POSTGRES_PASSWORD="$PG_PASS" >/dev/null
log "secret/database written (POSTGRES_PASSWORD)."

# DATABASE_URL: costruita dalle variabili Postgres, così il backend la legge
# da Vault e non dal compose (punto 7).
PG_USER="$(get_env_var POSTGRES_USER)"
PG_DB="$(get_env_var POSTGRES_DB)"
[ -n "$PG_USER" ] || die "POSTGRES_USER is missing in $ENV_FILE."
[ -n "$PG_DB" ]   || die "POSTGRES_DB is missing in $ENV_FILE."
DB_URL="postgresql://${PG_USER}:${PG_PASS}@database:5432/${PG_DB}?schema=public"

JWT_SECRET_V="$(get_env_var JWT_SECRET)"
JWT_REFRESH_V="$(get_env_var JWT_REFRESH_SECRET)"
COOKIE_V="$(get_env_var COOKIE_SECRET)"
TWOFA_V="$(get_env_var TWO_FACTOR_AUTH)"
[ -n "$JWT_SECRET_V" ]  || { JWT_SECRET_V="$(gen_secret)";  log "JWT_SECRET not in .env: generated."; }
[ -n "$JWT_REFRESH_V" ] || { JWT_REFRESH_V="$(gen_secret)"; log "JWT_REFRESH_SECRET not in .env: generated."; }
[ -n "$COOKIE_V" ]      || { COOKIE_V="$(gen_secret)";      log "COOKIE_SECRET not in .env: generated."; }
[ -n "$TWOFA_V" ]       || { TWOFA_V="$(gen_secret)";       log "TWO_FACTOR_AUTH not in .env: generated."; }

vexec kv put secret/backend \
        DATABASE_URL="$DB_URL" \
        JWT_SECRET="$JWT_SECRET_V" \
        JWT_REFRESH_SECRET="$JWT_REFRESH_V" \
        COOKIE_SECRET="$COOKIE_V" \
        TWO_FACTOR_AUTH="$TWOFA_V" >/dev/null
log "secret/backend written (DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, COOKIE_SECRET, TWO_FACTOR_AUTH)."

# ---------------------------------------------------------------------------
step "role_id / secret_id -> $ENV_FILE"
# ---------------------------------------------------------------------------
for svc in acme database backend; do
	UPPER="$(printf '%s' "$svc" | tr 'a-z' 'A-Z')"
	ROLE_ID="$(vexec read -field=role_id "auth/approle/role/${svc}-role/role-id")"
	SECRET_ID="$(vexec write -f -field=secret_id "auth/approle/role/${svc}-role/secret-id")"
	[ -n "$ROLE_ID" ] && [ -n "$SECRET_ID" ] || die "could not get IDs for ${svc}-role."
	set_env_var "${UPPER}_VAULT_ROLE_ID" "$ROLE_ID"
	set_env_var "${UPPER}_VAULT_SECRET_ID" "$SECRET_ID"
	log "${UPPER}_VAULT_ROLE_ID / ${UPPER}_VAULT_SECRET_ID updated."
done

# ---------------------------------------------------------------------------
step "Done"
# ---------------------------------------------------------------------------
log "Vault is initialized, unsealed and configured."
log ""
log "Next steps:"
log "  1. Remove (or comment out) the secrets that now live in Vault from"
log "     $ENV_FILE: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, COOKIE_SECRET, TWO_FACTOR_AUTH."
log "  2. Start the whole stack:  make"
log "  3. After any future restart Vault comes back sealed:"
log "     ./unseal.sh <key1> <key2> <key3>   (keys are in $KEYS_FILE)"