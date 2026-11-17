#!/bin/sh

# Exit immediately if any command returns a non-zero exit code (an error)
set -e

echo ""
echo "=== Starting Backend Service ==="

# ---------------------------------------------------------------------------
# Fetch secrets from HashiCorp Vault (AppRole login -> read secret/backend)
# Retries because Vault may be sealed/not ready yet (e.g. after a restart).
# ---------------------------------------------------------------------------
VAULT_JS='
const base = process.env.VAULT_ADDR;
const roleId = process.env.BACKEND_VAULT_ROLE_ID;
const secretId = process.env.BACKEND_VAULT_SECRET_ID;

class FatalVaultError extends Error {}

async function readErrorBody(res) {
  try {
    return (await res.text()).trim();
  } catch {
    return "";
  }
}

(async () => {
  if (!base || !roleId || !secretId) {
    throw new FatalVaultError(
      "Missing VAULT_ADDR, BACKEND_VAULT_ROLE_ID, or BACKEND_VAULT_SECRET_ID. Check docker/.env (must match the active Vault instance; run make vault-init to resync)."
    );
  }
  const login = await fetch(base + "/v1/auth/approle/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
  });
  if (!login.ok) {
    const body = await readErrorBody(login);
    const detail = body ? ": " + body : "";
    if (login.status === 400 || login.status === 403) {
      throw new FatalVaultError(
        `Vault AppRole login rejected for backend-role (HTTP ${login.status})${detail}. Check BACKEND_VAULT_ROLE_ID and BACKEND_VAULT_SECRET_ID in docker/.env (they must match the active Vault instance; run make vault-init to resync).`
      );
    }
    throw new Error(`AppRole login failed for backend-role (HTTP ${login.status})${detail}`);
  }
  const token = (await login.json()).auth.client_token;
  const res = await fetch(base + "/v1/secret/data/backend", { headers: { "X-Vault-Token": token } });
  if (!res.ok) {
    const body = await readErrorBody(res);
    const detail = body ? ": " + body : "";
    if (res.status === 403 || res.status === 404) {
      throw new FatalVaultError(`Failed to read secret/data/backend from Vault (HTTP ${res.status})${detail}`);
    }
    throw new Error(`read secret/backend failed (HTTP ${res.status})${detail}`);
  }
  const data = (await res.json()).data.data;
  for (const [k, v] of Object.entries(data)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(k) || String(v).includes("\x27")) throw new FatalVaultError("unsafe key/value: " + k);
    console.log("export " + k + "=\x27" + v + "\x27");
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(e instanceof FatalVaultError ? 2 : 1);
});
'

if [ "${USE_VAULT:-true}" = "true" ]; then
  echo "Fetching secrets from Vault..."
  attempts=0
  while true; do
    set +e
    VAULT_ENV=$(node -e "$VAULT_JS")
    rc=$?
    set -e
    if [ "$rc" -eq 0 ]; then
      break
    fi
    if [ "$rc" -eq 2 ]; then
      echo "ERROR: Aborting backend startup due to invalid Vault credentials or configuration." >&2
      exit 1
    fi
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "ERROR: Vault not reachable/unsealed after 30 attempts. Aborting." >&2
      exit 1
    fi
    echo "Vault not ready (attempt $attempts/30), retrying in 5s..."
    sleep 5
  done
  eval "$VAULT_ENV"
  unset VAULT_ENV BACKEND_VAULT_SECRET_ID   # the SecretID is no longer needed
  echo "Secrets loaded from Vault."
else
  echo "USE_VAULT=false: Vault disabled, using the secrets from the environment (.env)."
fi

# Handle Prisma client generation and database migrations
if [ -x "./node_modules/.bin/prisma" ]; then
  echo "Generating Prisma Client..."
  ./node_modules/.bin/prisma generate

  # Apply any pending database migrations
  echo "Applying database migrations..."
  npx prisma migrate deploy

  # Run database seed (idempotent initial data)
  echo "Seeding database..."
  if [ -x "./node_modules/.bin/tsx" ]; then
    npx prisma db seed
  else
    node dist/prisma/seed/index.js
  fi
else
  echo "ERROR: Prisma CLI not found in ./node_modules/.bin/prisma."
  exit 1
fi

echo "Backend initialization complete! Starting application..."
echo ""

# Execute the command passed as argument to the Dockerfile (CMD). Using 'exec'
# is ESSENTIAL because exec replaces the shell process with the application process.
# This way the Node process becomes PID 1 and correctly receives stop signals.
exec "$@"