import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

// 1. Stub Prisma lifecycle hooks to prevent database connections during headless generation
PrismaService.prototype.onModuleInit = async () => {};

// 2. Inject safe development fallback defaults if not provided
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.PRODUCTION_FLAG = process.env.PRODUCTION_FLAG || 'false';

// 3. Import AppModule AFTER lifecycle stubs are applied
import { AppModule } from './app.module';

async function generate() {
  console.log('Compiling NestJS application metadata (headless mode)...');
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('WeCook API')
    .setDescription(
      'RESTful backend API specification for the WeCook recipe sharing social platform.\n\n' +
        '### Authentication\n' +
        'Authentication is based on secure, HttpOnly JWT cookies:\n' +
        '- **`accessToken`**: Short-lived (10 minutes) JWT sent automatically by browsers or HTTP clients on protected endpoints.\n' +
        '- **`refreshToken`**: Long-lived (7 days) JWT restricted to the `/api/auth/refresh` path.\n\n' +
        '### Media Storage & Static Assets\n' +
        'Uploaded recipe covers, step images, gallery photos, videos, and user avatars are served statically under `/uploads/`.\n\n' +
        '### Localization & Multilingual Engine\n' +
        'Recipes and catalogs support Italian (`it`), English (`en`), and French (`fr`), powered by LibreTranslate relational projection.',
    )
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'Local Development Server')
    .addServer('https://app.we-cook.it:8443', 'Staging / Production Server')
    .addTag(
      'Auth',
      'User authentication, registration, session management, and two-factor authentication (2FA)',
    )
    .addTag(
      'Users',
      'User accounts, public profiles, avatars, and liked recipes',
    )
    .addTag(
      'Friends',
      'Bidirectional friendships, friend discovery, and friend request lifecycle management',
    )
    .addTag(
      'Recipes',
      'Recipe creation, localized details, pagination, step illustrations, media uploads, and likes',
    )
    .addTag(
      'Catalog',
      'Curated ingredient catalogs, dietary tags, units of measure, and system metadata',
    )
    .addTag(
      'Notifications',
      'User activity notifications, inbox management, and real-time alerts',
    )
    .addTag(
      'System',
      'Health check, status probes, and system connectivity testing',
    )
    .addCookieAuth('accessToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'accessToken',
      description: 'JWT Access Token stored in HttpOnly cookie (`accessToken`)',
    })
    .addCookieAuth('refreshToken', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refreshToken',
      description:
        'JWT Refresh Token stored in HttpOnly cookie (`refreshToken`) for the refresh endpoint',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const specJson = JSON.stringify(document, null, 2);

  // Target 1: src/backend/openapi.json (canonical)
  const backendSpecPath = path.resolve(__dirname, '../openapi.json');
  fs.writeFileSync(backendSpecPath, specJson + '\n');
  console.log(`Generated canonical spec at: ${backendSpecPath}`);

  // Target 2: Root openapi.json (relative symlink: src/backend/openapi.json)
  const rootSpecPath = path.resolve(__dirname, '../../../openapi.json');
  try {
    if (fs.existsSync(rootSpecPath) || fs.lstatSync(rootSpecPath).isSymbolicLink()) {
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
  const fernSpecPath = path.resolve(__dirname, '../../../fern/openapi/openapi.json');
  try {
    if (fs.existsSync(fernSpecPath) || fs.lstatSync(fernSpecPath).isSymbolicLink()) {
      fs.unlinkSync(fernSpecPath);
    }
  } catch {}
  try {
    fs.symlinkSync('../../src/backend/openapi.json', fernSpecPath);
    console.log(`Created symlink: fern/openapi/openapi.json -> ../../src/backend/openapi.json`);
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
