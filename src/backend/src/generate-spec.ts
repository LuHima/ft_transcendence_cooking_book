import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { createSwaggerConfig } from './common/config/swagger.config';

// 1. Stub Prisma lifecycle hooks to prevent database connections during headless generation
PrismaService.prototype.onModuleInit = async () => {};

// 2. Inject safe development fallback defaults if not provided
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.PRODUCTION_FLAG = process.env.PRODUCTION_FLAG || 'false';

// 3. Import AppModule AFTER lifecycle stubs are applied
import { AppModule } from './app.module';

async function generate() {
  console.log('Compiling NestJS application metadata (headless mode)...');
  const app = await NestFactory.create(AppModule, { logger: false });
  // Needed to prefix /api to all API routes
  app.setGlobalPrefix('api');

  const config = createSwaggerConfig();

  const document = SwaggerModule.createDocument(app, config);
  const specJson = JSON.stringify(document, null, 2);

  // Compute canonical paths whether running from src/ or dist/src/
  const isDist = __dirname.includes(path.join('dist', 'src'));
  const backendDir = isDist
    ? path.resolve(__dirname, '../../')
    : path.resolve(__dirname, '../');

  const repoRootDir = path.resolve(backendDir, '../../');

  const backendSpecPath = path.join(backendDir, 'openapi.json');
  const rootSpecPath = path.join(repoRootDir, 'openapi.json');
  const fernSpecPath = path.join(
    repoRootDir,
    'fern',
    'openapi',
    'openapi.json',
  );

  // Target 1: src/backend/openapi.json (canonical)
  fs.writeFileSync(backendSpecPath, specJson + '\n');
  console.log(`Generated canonical spec at: ${backendSpecPath}`);

  // Target 2: Root openapi.json (relative symlink: src/backend/openapi.json)
  try {
    if (
      fs.existsSync(rootSpecPath) ||
      fs.lstatSync(rootSpecPath).isSymbolicLink()
    ) {
      fs.unlinkSync(rootSpecPath);
    }
  } catch {}
  try {
    fs.symlinkSync('src/backend/openapi.json', rootSpecPath);
    console.log(`Created symlink: openapi.json -> src/backend/openapi.json`);
  } catch {
    fs.writeFileSync(rootSpecPath, specJson + '\n');
    console.log(`Created spec mirror at: ${rootSpecPath}`);
  }

  // Target 3: fern/openapi/openapi.json (relative symlink: ../../src/backend/openapi.json)
  try {
    if (
      fs.existsSync(fernSpecPath) ||
      fs.lstatSync(fernSpecPath).isSymbolicLink()
    ) {
      fs.unlinkSync(fernSpecPath);
    }
  } catch {}
  try {
    fs.symlinkSync('../../src/backend/openapi.json', fernSpecPath);
    console.log(
      `Created symlink: fern/openapi/openapi.json -> ../../src/backend/openapi.json`,
    );
  } catch {
    fs.writeFileSync(fernSpecPath, specJson + '\n');
    console.log(`Created spec mirror at: ${fernSpecPath}`);
  }

  await app.close();
  console.log('OpenAPI headless generation completed successfully.');
  process.exit(0);
}

generate().catch((err) => {
  console.error('Failed to generate OpenAPI specification:', err);
  process.exit(1);
});
