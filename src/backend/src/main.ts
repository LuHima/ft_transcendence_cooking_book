import { NestFactory, APP_GUARD } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalNotEmptyBodyPipe } from './common/pipes/global-not-empty-body.pipe';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/filters/http.exeption.filter';
import { PrismaExceptionFilter } from './common/filters/prisma.exception.filter';
import {
  RECIPE_UPLOADS_DIR,
  AVATAR_UPLOADS_DIR,
  UPLOADS_DIR,
} from './common/config/upload-paths';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Spegnimanto pulito in caso di SIGINT ecc..
  app.enableShutdownHooks();
  // Assicura che le directory uploads esistano e serve i file statici
  fs.mkdirSync(RECIPE_UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(AVATAR_UPLOADS_DIR, { recursive: true });
  app.useStaticAssets(UPLOADS_DIR, {
    prefix: '/uploads/',
  });
  // Al posto di scrivere http://localhost:3000 si srive /api/
  app.setGlobalPrefix('api');
  // Per lavorare con i cookie
  app.use(cookieParser(process.env.COOKIE_SECRET));
  // Uso il mio filtro per gestire l'errore
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());
  app.useGlobalPipes(
    // Blocca {} vuoti su tutti i body
    new GlobalNotEmptyBodyPipe(),
    new ValidationPipe({
      // Ignora i campi non presenti nel DTO
      whitelist: true,
      // Dà errore se riceve campi non esistenti per i DTO
      forbidNonWhitelisted: true,
      // Abilita la trasformazione dei tipi e l'esecuzione di @Transform()
      transform: true,
    }),
  );
  app.enableCors({
    origin: ['http://localhost:5173', 'https://localhost:8443'],
    credentials: true,
  });

  /* OpenAPI documentation */
  // Build OpenAPI document configuration
  const config = new DocumentBuilder()
    .setTitle('WeCook API')
    .setDescription(
      'RESTful backend API specification for the WeCook recipe sharing social platform.\n\n' +
        '### Authentication\n' +
        'Authentication is based on secure, HttpOnly JWT cookies:\n' +
        '- **`accessToken`**: Short-lived (10 minutes) JWT sent automatically by browsers or HTTP clients on protected endpoints.\n' +
        '- **`refresh_token`**: Long-lived (7 days) JWT restricted to the `/api/auth/refresh` path.\n\n' +
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
      'Recipes',
      'Recipe creation, localized details, pagination, step illustrations, media uploads, and likes',
    )
    .addTag(
      'Catalog',
      'Curated ingredient catalogs, dietary tags, units of measure, and system metadata',
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
    .addCookieAuth('refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'refresh_token',
      description:
        'JWT Refresh Token stored in HttpOnly cookie (`refresh_token`) for the refresh endpoint',
    })
    .build();

  // Generate OpenAPI Document
  const document = SwaggerModule.createDocument(app, config);
  // Mount Swagger UI at http://localhost:3000/api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  // Export openapi.json for Fern, Postman, and AI agent consumers
  fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
  /* try {
    fs.writeFileSync('../openapi.json', JSON.stringify(document, null, 2));
  } catch {
    // Silently continue if root write is not accessible
  }
  try {
    fs.writeFileSync('../fern/openapi/openapi.json', JSON.stringify(document, null, 2));
  } catch {
    // Silently continue if fern directory is not accessible
  } */

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
