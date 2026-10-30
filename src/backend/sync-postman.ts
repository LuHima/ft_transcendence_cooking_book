import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 1. Resolve credentials via Precedence Cascade:
//    1. process.env.POSTMAN_API_KEY
//    2. docker/.env
//    3. .env

function resolveApiKey(): string {
  if (process.env.POSTMAN_API_KEY && process.env.POSTMAN_API_KEY.trim() !== '') {
    return process.env.POSTMAN_API_KEY.trim();
  }

  const rootDir = path.resolve(__dirname, '..', '..');
  const dockerEnvPath = path.join(rootDir, 'docker', '.env');
  if (fs.existsSync(dockerEnvPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(dockerEnvPath));
    if (envConfig.POSTMAN_API_KEY && envConfig.POSTMAN_API_KEY.trim() !== '') {
      return envConfig.POSTMAN_API_KEY.trim();
    }
  }

  const rootEnvPath = path.join(rootDir, '.env');
  if (fs.existsSync(rootEnvPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(rootEnvPath));
    if (envConfig.POSTMAN_API_KEY && envConfig.POSTMAN_API_KEY.trim() !== '') {
      return envConfig.POSTMAN_API_KEY.trim();
    }
  }

  throw new Error(
    'POSTMAN_API_KEY not found!\n' +
      'Please export POSTMAN_API_KEY in your environment, or configure it in docker/.env or .env.\n' +
      'Example: POSTMAN_API_KEY=PMAK-xxxx-xxxx',
  );
}

// Configuration
const SPEC_ID = '985a2bd8-1fd5-47c4-8630-b84b310ed91c'; // WeCook API spec
const COLLECTION_UID = '55074297-6cea2a4e-1dde-4ec2-9aa1-e861f9fee048'; // WeCook API collection
const FILE_PATH = 'openapi.json';
const POSTMAN_API_BASE = 'https://api.getpostman.com';

async function updateSpecFile(apiKey: string, specContent: string): Promise<void> {
  console.log(`Uploading OpenAPI specification to Postman Spec (${SPEC_ID})...`);
  const url = `${POSTMAN_API_BASE}/specs/${SPEC_ID}/files/${FILE_PATH}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content: specContent }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to update Postman spec file (HTTP ${res.status}): ${errText}`);
  }
  console.log('Postman spec file updated successfully.');
}

async function triggerCollectionSync(apiKey: string): Promise<string> {
  console.log(`Triggering native Spec-to-Collection sync for Collection (${COLLECTION_UID})...`);
  const url = `${POSTMAN_API_BASE}/specs/${SPEC_ID}/collections/${COLLECTION_UID}/sync`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (res.status !== 202) {
    const errText = await res.text();
    throw new Error(`Failed to trigger spec sync (HTTP ${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { taskId: string; url: string };
  console.log(`Sync task started with Task ID: ${data.taskId}`);
  return data.taskId;
}

async function pollSyncTask(apiKey: string, taskId: string): Promise<void> {
  console.log('Polling Postman synchronization task status...');
  const url = `${POSTMAN_API_BASE}/specs/${SPEC_ID}/tasks/${taskId}`;
  const startTime = Date.now();
  const TIMEOUT_MS = 30000;
  const POLL_INTERVAL_MS = 2000;

  while (Date.now() - startTime < TIMEOUT_MS) {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to query sync task status (HTTP ${res.status}): ${errText}`);
    }

    const data = (await res.json()) as {
      status?: string;
      error?: unknown;
      message?: string;
    };

    const status = data.status?.toUpperCase();
    console.log(`Task status: ${status || 'PENDING'}`);

    if (status === 'COMPLETED' || status === 'SUCCESS') {
      console.log('Postman Spec-to-Collection synchronization COMPLETED successfully.');
      return;
    }

    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(
        `Postman Spec-to-Collection synchronization FAILED: ${JSON.stringify(data.error || data.message || data)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Synchronization task ${taskId} timed out after ${TIMEOUT_MS / 1000} seconds.`);
}

async function updateCollectionName(apiKey: string): Promise<void> {
  const url = `${POSTMAN_API_BASE}/collections/${COLLECTION_UID}`;
  const getRes = await fetch(url, {
    headers: { 'X-Api-Key': apiKey },
  });
  if (!getRes.ok) return;

  const data = (await getRes.json()) as { collection: { info: { name: string; schema: string } } };
  if (data.collection?.info && data.collection.info.name !== 'WeCook API') {
    console.log(`Updating Postman collection display name to "WeCook API"...`);
    data.collection.info.name = 'WeCook API';
    await fetch(url, {
      method: 'PUT',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  }
}

async function main() {
  try {
    const apiKey = resolveApiKey();
    const specPath = path.resolve(__dirname, 'openapi.json');
    if (!fs.existsSync(specPath)) {
      throw new Error(`Specification file not found at ${specPath}. Run 'npm run openapi:generate' first.`);
    }

    const specContent = fs.readFileSync(specPath, 'utf8');

    // 1. Update spec file on Postman
    await updateSpecFile(apiKey, specContent);

    // 2. Trigger native collection sync
    const taskId = await triggerCollectionSync(apiKey);

    // 3. Poll task status
    await pollSyncTask(apiKey, taskId);

    // 4. Ensure collection display name is "WeCook API"
    await updateCollectionName(apiKey);

    console.log('Postman synchronization workflow finished cleanly.');
    process.exit(0);
  } catch (err: any) {
    console.error(`Postman synchronization failed: ${err.message}`);
    process.exit(1);
  }
}

main();
