#!/bin/sh
# unseal.sh — Comfort script to unseal Vault after every container restart.
#
# WHY THIS IS MANUAL AND NOT AUTOMATIC:
# Vault encrypts everything at rest using a master key that is split into
# 5 shares (Shamir's Secret Sharing). No single share — and no single
# component of this stack — ever holds enough information alone to decrypt
# the data. That's the whole point of using Vault instead of a plain .env
# file: encryption + isolation, as required by the subject.
# Automating this away (e.g. baking the keys into an image or a mounted
# file read at container startup) would defeat that property entirely.
#
# USAGE:
#   ./unseal.sh <unseal_key_1> <unseal_key_2> <unseal_key_3>
#
# Run this once after every `make` / `docker-compose up`, using any 3 of
# your 5 unseal keys (threshold = 3, as set at `vault operator init`).

set -e

if [ "$#" -ne 3 ]; then
	echo "Usage: $0 <unseal_key_1> <unseal_key_2> <unseal_key_3>"
	echo "(any 3 of your 5 Vault unseal keys, in any order)"
	exit 1
fi

VAULT_CONTAINER="${VAULT_CONTAINER:-vault-container}"
VAULT_ADDR_LOCAL="${VAULT_ADDR_LOCAL:-http://127.0.0.1:8200}"

echo "=== Unsealing Vault (${VAULT_CONTAINER}) ==="

for KEY in "$1" "$2" "$3"; do
	docker exec -e VAULT_ADDR="${VAULT_ADDR_LOCAL}" "${VAULT_CONTAINER}" \
		vault operator unseal "${KEY}" > /dev/null
done

echo ""
echo "=== Current Vault status ==="
docker exec -e VAULT_ADDR="${VAULT_ADDR_LOCAL}" "${VAULT_CONTAINER}" vault status

echo ""
echo "If 'Sealed' above shows 'false', Vault is ready."
echo "Services with 'restart: unless-stopped' (e.g. database) will"
echo "automatically retry and come up healthy within a few seconds."