#!/bin/sh
set -e

# Fetch POSTGRES_PASSWORD from Vault via AppRole, then hand off to the
# original Postgres entrypoint. This container never reads the password
# from .env directly.

VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"

# Development mode (USE_VAULT=false): skip Vault, POSTGRES_PASSWORD comes
# from the environment (.env).
if [ "${USE_VAULT:-true}" != "true" ]; then
	echo "USE_VAULT=false: Vault disabled, using POSTGRES_PASSWORD from the environment."
	exec docker-entrypoint.sh postgres
fi

if [ -z "$VAULT_ROLE_ID" ] || [ -z "$VAULT_SECRET_ID" ]; then
	echo "ERROR: DATABASE_VAULT_ROLE_ID or DATABASE_VAULT_SECRET_ID is missing (mapped to VAULT_ROLE_ID / VAULT_SECRET_ID). Check docker/.env or run 'make vault-init'." >&2
	exit 1
fi

# Perform a Vault HTTP request and capture HTTP status + body without leaking
# secrets. Sets VAULT_HTTP_CODE and VAULT_RESP_BODY.
vault_request() {
	_method="$1"
	_url="$2"
	_header="$3"
	_body="$4"

	set +e
	if [ -n "$_body" ]; then
		_raw=$(curl -sS -w '\n%{http_code}' -X "$_method" -d "$_body" "$_url")
	elif [ -n "$_header" ]; then
		_raw=$(curl -sS -w '\n%{http_code}' -X "$_method" -H "$_header" "$_url")
	else
		_raw=$(curl -sS -w '\n%{http_code}' -X "$_method" "$_url")
	fi
	_rc=$?
	set -e

	if [ "$_rc" -ne 0 ]; then
		echo "ERROR: Failed to reach Vault at ${_url} (curl exit ${_rc})." >&2
		return "$_rc"
	fi

	VAULT_HTTP_CODE=$(printf '%s\n' "$_raw" | tail -n 1)
	VAULT_RESP_BODY=$(printf '%s\n' "$_raw" | sed '$d')
}

echo "=== Authenticating to Vault (database-role) ==="

vault_request POST "${VAULT_ADDR}/v1/auth/approle/login" "" \
	"{\"role_id\":\"${VAULT_ROLE_ID}\",\"secret_id\":\"${VAULT_SECRET_ID}\"}"

if [ "$VAULT_HTTP_CODE" -ne 200 ]; then
	if [ "$VAULT_HTTP_CODE" -eq 400 ] || [ "$VAULT_HTTP_CODE" -eq 403 ]; then
		echo "ERROR: Vault AppRole login rejected for database-role (HTTP ${VAULT_HTTP_CODE}): ${VAULT_RESP_BODY}. Check DATABASE_VAULT_ROLE_ID and DATABASE_VAULT_SECRET_ID in docker/.env (they must match the active Vault instance; run 'make vault-init' to resync)." >&2
	else
		echo "ERROR: Vault AppRole login failed for database-role (HTTP ${VAULT_HTTP_CODE}): ${VAULT_RESP_BODY}." >&2
	fi
	exit 1
fi

VAULT_TOKEN=$(echo "$VAULT_RESP_BODY" | grep -o '"client_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$VAULT_TOKEN" ]; then
	echo "ERROR: Failed to parse client_token from Vault AppRole login response." >&2
	exit 1
fi

echo "=== Fetching POSTGRES_PASSWORD from Vault ==="

vault_request GET "${VAULT_ADDR}/v1/secret/data/database" "X-Vault-Token: ${VAULT_TOKEN}" ""

if [ "$VAULT_HTTP_CODE" -ne 200 ]; then
	echo "ERROR: Failed to read secret/data/database from Vault (HTTP ${VAULT_HTTP_CODE}): ${VAULT_RESP_BODY}." >&2
	exit 1
fi

export POSTGRES_PASSWORD=$(echo "$VAULT_RESP_BODY" | grep -o '"POSTGRES_PASSWORD":"[^"]*"' | cut -d'"' -f4)

if [ -z "$POSTGRES_PASSWORD" ]; then
	echo "ERROR: POSTGRES_PASSWORD not found in Vault response." >&2
	exit 1
fi

echo "=== Secret retrieved successfully. Starting PostgreSQL ==="

# Hand off to the original Postgres entrypoint
exec docker-entrypoint.sh postgres