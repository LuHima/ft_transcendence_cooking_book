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
(async () => {
  if (!base || !roleId || !secretId) throw new Error("missing VAULT_ADDR / BACKEND_VAULT_ROLE_ID / BACKEND_VAULT_SECRET_ID");
  const login = await fetch(base + "/v1/auth/approle/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
  });
  if (!login.ok) throw new Error("AppRole login failed: HTTP " + login.status);
  const token = (await login.json()).auth.client_token;
  const res = await fetch(base + "/v1/secret/data/backend", { headers: { "X-Vault-Token": token } });
  if (!res.ok) throw new Error("read secret/backend failed: HTTP " + res.status);
  const data = (await res.json()).data.data;
  for (const [k, v] of Object.entries(data)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(k) || String(v).includes("\x27")) throw new Error("unsafe key/value: " + k);
    console.log("export " + k + "=\x27" + v + "\x27");
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
'

echo "Fetching secrets from Vault..."
attempts=0
until VAULT_ENV=$(node -e "$VAULT_JS"); do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 30 ]; then
    echo "ERROR: Vault not reachable/unsealed after 30 attempts. Aborting."
    exit 1
  fi
  echo "Vault not ready (attempt $attempts/30), retrying in 5s..."
  sleep 5
done
eval "$VAULT_ENV"
unset VAULT_ENV BACKEND_VAULT_SECRET_ID   # the SecretID is no longer needed
echo "Secrets loaded from Vault."

# Generate Prisma client based on current schema
echo "Generating Prisma Client..."
npx prisma generate

# Apply any pending database migrations
echo "Applying database migrations..."
npx prisma migrate deploy

# Run database seed (idempotent initial data)
echo "Seeding database..."
npx prisma db seed

echo "Backend initialization complete! Starting application..."
echo ""

# Execute the command passed as argument to the Dockerfile (CMD). Using 'exec'
# is ESSENTIAL because exec replaces the shell process with the application process.
# This way the Node process becomes PID 1 and correctly receives stop signals.
exec "$@"