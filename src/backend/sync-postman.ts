import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export function findProjectRoot(): string {
  let curr = __dirname;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, '.git')) || fs.existsSync(path.join(curr, 'docker', '.env'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return path.resolve(__dirname, '..', '..');
}

export function resolveApiKey(): string {
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

export function resolveCollectionUid(): string {
  if (process.env.POSTMAN_COLLECTION_UID && process.env.POSTMAN_COLLECTION_UID.trim() !== '') {
    return process.env.POSTMAN_COLLECTION_UID.trim();
  }
  if (process.env.COLLECTION_UID && process.env.COLLECTION_UID.trim() !== '') {
    return process.env.COLLECTION_UID.trim();
  }

  const rootDir = findProjectRoot();
  const dockerEnvPath = path.join(rootDir, 'docker', '.env');
  if (fs.existsSync(dockerEnvPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(dockerEnvPath));
    const uid = envConfig.POSTMAN_COLLECTION_UID || envConfig.COLLECTION_UID;
    if (uid && uid.trim() !== '') {
      return uid.trim();
    }
  }

  const rootEnvPath = path.join(rootDir, '.env');
  if (fs.existsSync(rootEnvPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(rootEnvPath));
    const uid = envConfig.POSTMAN_COLLECTION_UID || envConfig.COLLECTION_UID;
    if (uid && uid.trim() !== '') {
      return uid.trim();
    }
  }

  const postmanConfigPath = path.join(rootDir, '.postman.json');
  if (fs.existsSync(postmanConfigPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(postmanConfigPath, 'utf8'));
      const defaultKey = config.default?.collection || 'wecook-api';
      const uid = config.collections?.[defaultKey]?.uid;
      if (uid && uid.trim() !== '') {
        return uid.trim();
      }
    } catch {
      // ignore
    }
  }

  throw new Error(
    'POSTMAN_COLLECTION_UID not found!\n' +
      'Please export POSTMAN_COLLECTION_UID in your environment, or configure it in docker/.env or .env.\n' +
      'Example: POSTMAN_COLLECTION_UID=55074297-6cea2a4e-1dde-4ec2-9aa1-e861f9fee048',
  );
}

const POSTMAN_API_BASE = 'https://api.getpostman.com';

export async function uploadCollection(apiKey: string, collectionUid: string, collectionData: any): Promise<void> {
  console.log(`Uploading compiled collection to Postman (${collectionUid})...`);
  const url = `${POSTMAN_API_BASE}/collections/${collectionUid}`;

  const payload = {
    collection: {
      ...collectionData,
      info: {
        ...collectionData.info,
      },
    },
  };
  // Remove _postman_id from payload so Postman associates with target collectionUid cleanly
  delete payload.collection.info._postman_id;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'X-Api-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to upload Postman collection (HTTP ${res.status}): ${errText}`);
  }

  const result: any = await res.json();
  console.log(`Postman collection updated successfully. (ID: ${result.collection?.id || collectionUid})`);
}

async function main() {
  try {
    const apiKey = resolveApiKey();
    const collectionUid = resolveCollectionUid();
    const collectionPath = path.resolve(__dirname, 'test', 'wecook-api.postman_collection.json');

    if (!fs.existsSync(collectionPath)) {
      throw new Error(`Collection file not found at ${collectionPath}. Run 'npm run postman:build' first.`);
    }

    const collectionRaw = fs.readFileSync(collectionPath, 'utf8');
    const collectionData = JSON.parse(collectionRaw);

    await uploadCollection(apiKey, collectionUid, collectionData);

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
