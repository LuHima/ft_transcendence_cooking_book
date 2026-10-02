#!/bin/sh
set -e

# Fetch POSTGRES_PASSWORD from Vault via AppRole, then hand off to the
# original Postgres entrypoint. This container never reads the password
# from .env directly.

VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"

if [ -z "$VAULT_ROLE_ID" ] || [ -z "$VAULT_SECRET_ID" ]; then
	echo "ERROR: VAULT_ROLE_ID or VAULT_SECRET_ID is missing."
	exit 1
fi

echo "=== Authenticating to Vault (database-role) ==="

LOGIN_RESPONSE=$(curl -s --fail -X POST \
	-d "{\"role_id\":\"${VAULT_ROLE_ID}\",\"secret_id\":\"${VAULT_SECRET_ID}\"}" \
	"${VAULT_ADDR}/v1/auth/approle/login")

VAULT_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"client_token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$VAULT_TOKEN" ]; then
	echo "ERROR: Failed to authenticate to Vault."
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

echo "=== Secret retrieved successfully. Starting PostgreSQL ==="

# Hand off to the original Postgres entrypoint
exec docker-entrypoint.sh postgres