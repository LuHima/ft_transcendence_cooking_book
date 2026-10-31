import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

function findProjectRoot(): string {
  let curr = __dirname;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, '.git')) || fs.existsSync(path.join(curr, 'docker', '.env'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return path.resolve(__dirname, '..', '..');
}

function resolveApiKey(): string {
  if (process.env.POSTMAN_API_KEY && process.env.POSTMAN_API_KEY.trim() !== '') {
    return process.env.POSTMAN_API_KEY.trim();
  }

  const rootDir = findProjectRoot();
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
const COLLECTION_UID = '55074297-6cea2a4e-1dde-4ec2-9aa1-e861f9fee048'; // WeCook API collection
const POSTMAN_API_BASE = 'https://api.getpostman.com';

async function uploadCollection(apiKey: string, collectionData: any): Promise<void> {
  console.log(`Uploading compiled collection to Postman (${COLLECTION_UID})...`);
  const url = `${POSTMAN_API_BASE}/collections/${COLLECTION_UID}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ collection: collectionData }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload Postman collection (HTTP ${res.status}): ${errText}`);
  }

  const result: any = await res.json();
  console.log(`Postman collection updated successfully. (ID: ${result.collection?.id || COLLECTION_UID})`);
}

async function main() {
  try {
    const apiKey = resolveApiKey();
    const collectionPath = path.resolve(__dirname, 'test', 'wecook-api.postman_collection.json');

    if (!fs.existsSync(collectionPath)) {
      throw new Error(`Collection file not found at ${collectionPath}. Run 'npm run postman:build' first.`);
    }

    const collectionRaw = fs.readFileSync(collectionPath, 'utf8');
    const collectionData = JSON.parse(collectionRaw);

    await uploadCollection(apiKey, collectionData);

    console.log('Postman collection synchronization workflow finished cleanly.');
    process.exit(0);
  } catch (err: any) {
    console.error(`Postman synchronization failed: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
