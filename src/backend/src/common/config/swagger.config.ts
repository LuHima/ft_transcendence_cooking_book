import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';

/**
 * Creates the centralized OpenAPI DocumentBuilder configuration for WeCook API.
 * Single source of truth for runtime Swagger UI and offline headless contract generation.
 */
export function createSwaggerConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setTitle('WeCook API')
    .setDescription(
      'RESTful backend API specification for the WeCook recipe sharing social platform.\n\n' +
        '### Authentication\n' +
        'Authentication is based on secure, HttpOnly JWT cookies:\n' +
        '- **`accessToken`**: Short-lived (10 minutes) JWT sent automatically by browsers or HTTP clients on protected endpoints.\n' +
        '- **`refreshToken`**: Long-lived (7 days) JWT restricted to the `/api/auth/refresh` path.\n\n' +
        '### Protected Media Access & Video Streaming\n' +
        'Uploaded recipe covers, step images, gallery photos, tutorial videos, and user avatars are securely served under `/api/media/...` with recipe privacy tiers, mutual user block enforcement, weak ETag conditional revalidation, and RFC 9110 HTTP 206 Partial Content byte-range video streaming (migrated from legacy static `/uploads/`).\n\n' +
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
      'Feed',
      'Personalized chronological social activity feed of recipes shared by confirmed friends',
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
    .addTag(
      'Media',
      'Protected media delivery, recipe asset access control, RFC 9110 video range streaming, and avatars',
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
}

/**
 * Initializes and mounts Swagger UI on the NestJS application at /api/docs.
 */
export function setupSwagger(app: INestApplication): OpenAPIObject {
  const config = createSwaggerConfig();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  return document;
}
