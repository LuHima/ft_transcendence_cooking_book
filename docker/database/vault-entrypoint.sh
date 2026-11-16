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
	echo "ERROR: VAULT_ROLE_ID or VAULT_SECRET_ID is missing."
	exit 1
fi

echo "=== Authenticating to Vault (database-role) ==="

VAULT_TOKEN=""
attempts=0
while [ "$attempts" -lt 30 ]; do
	LOGIN_RESPONSE=$(curl -s --fail -X POST \
		-d "{\"role_id\":\"${VAULT_ROLE_ID}\",\"secret_id\":\"${VAULT_SECRET_ID}\"}" \
		"${VAULT_ADDR}/v1/auth/approle/login" 2>/dev/null) || LOGIN_RESPONSE=""
	VAULT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"client_token":"[^"]*"' | cut -d'"' -f4)
	if [ -n "$VAULT_TOKEN" ]; then
		break
	fi
	attempts=$((attempts + 1))
	echo "Vault not ready (attempt ${attempts}/30), retrying in 5s..."
	sleep 5
done

if [ -z "$VAULT_TOKEN" ]; then
	echo "ERROR: Failed to authenticate to Vault after 30 attempts."
	exit 1
fi

echo "=== Fetching POSTGRES_PASSWORD from Vault ==="

SECRET_RESPONSE=$(curl -s --fail \
	-H "X-Vault-Token: ${VAULT_TOKEN}" \
	"${VAULT_ADDR}/v1/secret/data/database")

export POSTGRES_PASSWORD=$(echo "$SECRET_RESPONSE" | grep -o '"POSTGRES_PASSWORD":"[^"]*"' | cut -d'"' -f4)

if [ -z "$POSTGRES_PASSWORD" ]; then
	echo "ERROR: POSTGRES_PASSWORD not found in Vault response."
	exit 1
fi

unset VAULT_SECRET_ID VAULT_TOKEN LOGIN_RESPONSE SECRET_RESPONSE

echo "=== Secret retrieved successfully. Starting PostgreSQL ==="

# Hand off to the original Postgres entrypoint
exec docker-entrypoint.sh postgres