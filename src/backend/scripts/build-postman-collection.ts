import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Converter = require('openapi-to-postmanv2');

const COLLECTION_ID = '6cea2a4e-1dde-4ec2-9aa1-e861f9fee048';
const COLLECTION_NAME = 'WeCook API';

export function normalizePathSlug(pathStr: string): string {
  const normalized = pathStr.replace(/\{([^}]+)\}/g, ':$1');
  const slug = normalized.replace(/:([a-zA-Z0-9_]+)/g, '_$1');
  return slug.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_]+/g, '_');
}

export function deterministicUuid(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-');
}

interface OverlayScript {
  testCode?: string;
  prerequestCode?: string;
}

function loadOverlayScripts(scriptsDir: string): Map<string, OverlayScript> {
  const scriptMap = new Map<string, OverlayScript>();
  if (!fs.existsSync(scriptsDir)) {
    return scriptMap;
  }

  function scan(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scan(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.test.js')) {
          const key = entry.name.replace(/\.test\.js$/, '');
          const existing = scriptMap.get(key) || {};
          existing.testCode = fs.readFileSync(fullPath, 'utf8');
          scriptMap.set(key, existing);
        } else if (entry.name.endsWith('.prerequest.js')) {
          const key = entry.name.replace(/\.prerequest\.js$/, '');
          const existing = scriptMap.get(key) || {};
          existing.prerequestCode = fs.readFileSync(fullPath, 'utf8');
          scriptMap.set(key, existing);
        }
      }
    }
  }

  scan(scriptsDir);
  return scriptMap;
}

function buildOpenApiResponseMap(openapi: any): Map<string, number> {
  const responseMap = new Map<string, number>();
  const paths = openapi.paths || {};

  for (const [p, methods] of Object.entries(paths)) {
    for (const [m, op] of Object.entries(methods as Record<string, any>)) {
      if (m === 'parameters' || typeof op !== 'object') continue;
      const method = m.toUpperCase();
      const slug = normalizePathSlug(p);
      const key = `${method}_${slug}`;

      let defaultStatus = method === 'POST' ? 201 : 200;
      if (op.responses) {
        const statuses = Object.keys(op.responses)
          .map((s) => parseInt(s, 10))
          .filter((code) => code >= 200 && code < 300);
        if (statuses.length > 0) {
          defaultStatus = statuses[0];
        }
      }
      responseMap.set(key, defaultStatus);
    }
  }

  return responseMap;
}

export async function buildPostmanCollection(): Promise<void> {
  const rootBackendDir = path.resolve(__dirname, '..');
  const openapiPath = path.join(rootBackendDir, 'openapi.json');
  const scriptsDir = path.join(rootBackendDir, 'test', 'postman-scripts');
  const outputCollectionPath = path.join(rootBackendDir, 'test', 'wecook-api.postman_collection.json');

  if (!fs.existsSync(openapiPath)) {
    throw new Error(`OpenAPI spec not found at ${openapiPath}. Run 'npm run openapi:generate' first.`);
  }

  const openapiContent = fs.readFileSync(openapiPath, 'utf8');
  const openapiJson = JSON.parse(openapiContent);

  const overlayScripts = loadOverlayScripts(scriptsDir);
  const responseMap = buildOpenApiResponseMap(openapiJson);

  console.log(`Converting ${openapiPath} via openapi-to-postmanv2...`);

  const conversionOptions = {
    folderStrategy: 'Tags',
    requestParametersResolution: 'Example',
    optimizeConversion: true,
    stacklimit: 50,
  };

  const collection: any = await new Promise((resolve, reject) => {
    Converter.convert(
      { type: 'string', data: openapiContent },
      conversionOptions,
      (err: any, conversionResult: any) => {
        if (err || !conversionResult.result) {
          reject(new Error(`openapi-to-postmanv2 conversion failed: ${err || conversionResult.reason}`));
        } else {
          resolve(conversionResult.output[0].data);
        }
      },
    );
  });

  // Normalize Collection metadata
  collection.info = {
    _postman_id: COLLECTION_ID,
    name: COLLECTION_NAME,
    description: openapiJson.info?.description || collection.info?.description || '',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  };

  collection.variable = [
    {
      key: 'baseUrl',
      value: 'https://app.we-cook.it:8443',
      type: 'string',
    },
  ];

  let overlaidCount = 0;
  let synthesizedCount = 0;

  function attachScripts(items: any[], parentFolder = '') {
    for (const item of items) {
      if (item.request) {
        const method = (item.request.method || 'GET').toUpperCase();
        let pathStr = '';
        if (typeof item.request.url === 'string') {
          pathStr = item.request.url.replace(/^\{\{[^}]+\}\}/, '');
        } else if (item.request.url?.path) {
          pathStr = '/' + (Array.isArray(item.request.url.path) ? item.request.url.path.join('/') : item.request.url.path);
        }

        const slug = normalizePathSlug(pathStr);
        const key = `${method}_${slug}`;

        item.id = deterministicUuid(`request:${method}:${slug}`);

        item.event = item.event || [];
        const existingOverlay = overlayScripts.get(key);

        if (existingOverlay) {
          if (existingOverlay.testCode) {
            item.event = item.event.filter((e: any) => e.listen !== 'test');
            item.event.push({
              listen: 'test',
              script: {
                id: deterministicUuid(`script:test:${method}:${slug}`),
                type: 'text/javascript',
                exec: existingOverlay.testCode.split('\n'),
              },
            });
            overlaidCount++;
          }
          if (existingOverlay.prerequestCode) {
            item.event = item.event.filter((e: any) => e.listen !== 'prerequest');
            item.event.push({
              listen: 'prerequest',
              script: {
                id: deterministicUuid(`script:prerequest:${method}:${slug}`),
                type: 'text/javascript',
                exec: existingOverlay.prerequestCode.split('\n'),
              },
            });
          }
        } else {
          // Synthesize default status assertion
          const expectedStatus = responseMap.get(key) || (method === 'POST' ? 201 : 200);
          item.event = item.event.filter((e: any) => e.listen !== 'test');
          item.event.push({
            listen: 'test',
            script: {
              id: deterministicUuid(`script:test:${method}:${slug}`),
              type: 'text/javascript',
              exec: [
                `pm.test("Status code is ${expectedStatus}", function () {`,
                `    pm.response.to.have.status(${expectedStatus});`,
                `});`,
              ],
            },
          });
          synthesizedCount++;
          console.log(`Synthesized baseline status test (${expectedStatus}) for new route: ${method} ${pathStr}`);
        }

        // Stabilize query parameters for determinism
        if (item.request.url && Array.isArray(item.request.url.query)) {
          for (const q of item.request.url.query) {
            if (q.key === 'lang') {
              q.value = 'it';
            }
          }
        }

        // Stabilize response IDs and query parameters
        if (Array.isArray(item.response)) {
          item.response.forEach((resp: any, idx: number) => {
            resp.id = deterministicUuid(`response:${method}:${slug}:${resp.name || resp.code || idx}`);
            if (resp.originalRequest?.url && Array.isArray(resp.originalRequest.url.query)) {
              for (const q of resp.originalRequest.url.query) {
                if (q.key === 'lang') {
                  q.value = 'it';
                }
              }
            }
          });
        }
      } else if (Array.isArray(item.item)) {
        item.id = deterministicUuid(`folder:${parentFolder}/${item.name}`);
        attachScripts(item.item, `${parentFolder}/${item.name}`);
      }
    }
  }

  attachScripts(collection.item);

  console.log(`Script overlay summary: ${overlaidCount} custom scripts overlaid, ${synthesizedCount} baseline tests synthesized.`);

  fs.writeFileSync(outputCollectionPath, JSON.stringify(collection, null, 2) + '\n', 'utf8');
  console.log(`Successfully compiled Postman collection: ${outputCollectionPath}`);
}

if (require.main === module) {
  buildPostmanCollection().catch((err) => {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  });
}
