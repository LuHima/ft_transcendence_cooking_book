import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as prettier from 'prettier';

function findProjectRoot(): string {
  let curr = __dirname;
  while (curr !== path.dirname(curr)) {
    if (fs.existsSync(path.join(curr, '.git')) || fs.existsSync(path.join(curr, 'docker', '.env'))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return path.resolve(__dirname, '..', '..', '..');
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
      'Please export POSTMAN_API_KEY in your environment, or configure it in docker/.env or .env.',
  );
}

const COLLECTION_UID = '55074297-6cea2a4e-1dde-4ec2-9aa1-e861f9fee048';
const ENVIRONMENT_UID = '55074297-23f04ddb-80a7-4ea2-bc68-77e88bb3a835';
const POSTMAN_API_BASE = 'https://api.getpostman.com';

export function normalizePathSlug(pathStr: string): string {
  const normalized = pathStr.replace(/\{([^}]+)\}/g, ':$1');
  const slug = normalized.replace(/:([a-zA-Z0-9_]+)/g, '_$1');
  return slug.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_]+/g, '_');
}

async function formatJs(code: string): Promise<string> {
  try {
    return await prettier.format(code, { parser: 'babel' });
  } catch {
    return code;
  }
}

async function extractScripts() {
  const apiKey = resolveApiKey();
  const baseTestDir = path.resolve(__dirname, '..', 'test', 'postman-scripts');
  fs.mkdirSync(baseTestDir, { recursive: true });

  console.log(`Fetching Postman collection (${COLLECTION_UID})...`);
  const colRes = await fetch(`${POSTMAN_API_BASE}/collections/${COLLECTION_UID}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  if (!colRes.ok) {
    throw new Error(`Failed to fetch collection (HTTP ${colRes.status}): ${await colRes.text()}`);
  }
  const colData = await colRes.json();
  const items = colData.collection?.item || [];

  let extractedCount = 0;

  async function processItems(itemList: any[], folderName = '') {
    for (const item of itemList) {
      if (item.request) {
        const method = (item.request.method || 'GET').toUpperCase();
        let pathStr = '';
        if (typeof item.request.url === 'string') {
          try {
            const parsed = new URL(item.request.url);
            pathStr = parsed.pathname;
          } catch {
            pathStr = item.request.url.replace(/^\{\{[^}]+\}\}/, '');
          }
        } else if (item.request.url?.path) {
          pathStr = '/' + (Array.isArray(item.request.url.path) ? item.request.url.path.join('/') : item.request.url.path);
        }

        const segments = pathStr.split('/').filter(Boolean);
        const tag = folderName ? folderName.toLowerCase() : segments[1]?.toLowerCase() || 'misc';
        const tagDir = path.join(baseTestDir, tag);
        fs.mkdirSync(tagDir, { recursive: true });

        const slug = normalizePathSlug(pathStr);
        const baseFilename = `${method}_${slug}`;

        if (Array.isArray(item.event)) {
          for (const ev of item.event) {
            const exec = ev.script?.exec;
            if (Array.isArray(exec) && exec.some((line: string) => line.trim())) {
              const code = exec.join('\n');
              const formatted = await formatJs(code);
              const scriptType = ev.listen === 'prerequest' ? 'prerequest' : 'test';
              const filePath = path.join(tagDir, `${baseFilename}.${scriptType}.js`);
              fs.writeFileSync(filePath, formatted, 'utf8');
              extractedCount++;
              console.log(`Saved: ${tag}/${baseFilename}.${scriptType}.js`);
            }
          }
        }
      }

      if (Array.isArray(item.item)) {
        await processItems(item.item, item.name || folderName);
      }
    }
  }

  await processItems(items);
  console.log(`Total extracted scripts: ${extractedCount}`);

  // Fetch and export Environment template
  console.log(`Fetching Postman environment (${ENVIRONMENT_UID})...`);
  const envRes = await fetch(`${POSTMAN_API_BASE}/environments/${ENVIRONMENT_UID}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  if (envRes.ok) {
    const envData = await envRes.json();
    if (envData.environment?.values) {
      for (const val of envData.environment.values) {
        if (val.key === 'accessToken' || val.key === 'refreshToken') {
          val.value = '';
        }
      }
    }
    const envOutPath = path.resolve(__dirname, '..', 'test', 'wecook-development.postman_environment.json');
    fs.writeFileSync(envOutPath, JSON.stringify(envData.environment, null, 2) + '\n', 'utf8');
    console.log(`Saved environment template to ${envOutPath}`);
  } else {
    console.warn(`Could not fetch environment (HTTP ${envRes.status}).`);
  }
}

extractScripts().catch((err) => {
  console.error(`Extraction failed: ${err.message}`);
  process.exit(1);
});
