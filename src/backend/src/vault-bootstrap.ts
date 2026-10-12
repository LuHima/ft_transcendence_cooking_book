// login AppRole → prendi token → leggi secret/data/backend → scrivi in process.env 
//prende segreti da Vault tramite APPROle e li scrive su process.env
// BEFORE Nest builds any module. Must be called as the very first thing
// in main.ts, before NestFactory.create().
//
// Falls back silently if Vault credentials are not provided (useful for
// environments where secrets are already in process.env some other way).
//ToCheck
async function fetchFromVault(): Promise<void> {
  const vaultAddr = process.env.VAULT_ADDR || 'http://vault:8200';
  const roleId = process.env.VAULT_ROLE_ID;
  const secretId = process.env.VAULT_SECRET_ID;

  if (!roleId || !secretId) {
    console.log('INFO: VAULT_ROLE_ID/VAULT_SECRET_ID not set; skipping Vault fetch.');
    return;
  }

  console.log('=== Authenticating to Vault (backend-role) ===');

  const loginRes = await fetch(`${vaultAddr}/v1/auth/approle/login`, {
    method: 'POST',
    body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
  });

  if (!loginRes.ok) {
    throw new Error(`Vault login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const vaultToken = loginData.auth?.client_token;

  if (!vaultToken) {
    throw new Error('Vault login succeeded but no client_token was returned.');
  }

  console.log('=== Fetching secrets from Vault ===');

  const secretRes = await fetch(`${vaultAddr}/v1/secret/data/backend`, {
    headers: { 'X-Vault-Token': vaultToken },
  });

  if (!secretRes.ok) {
    throw new Error(`Vault secret read failed: ${secretRes.status} ${await secretRes.text()}`);
  }

  const secretData = await secretRes.json();
  const values = secretData.data?.data;

  if (!values) {
    throw new Error('Vault response did not contain secret data.');
  }
//scrive tutti i segreti senza doverli enlencare
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value as string;
  }

  console.log('=== Secrets retrieved successfully from Vault ===');
}

export { fetchFromVault };