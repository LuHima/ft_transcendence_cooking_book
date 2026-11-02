import { INestApplication } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { createSwaggerConfig, setupSwagger } from './swagger.config';

describe('SwaggerConfig', () => {
  describe('createSwaggerConfig', () => {
    const config = createSwaggerConfig();

    it('should define general document metadata (title, version, description)', () => {
      expect(config.info.title).toBe('WeCook API');
      expect(config.info.version).toBe('1.0.0');
      expect(config.info.description).toContain(
        'RESTful backend API specification for the WeCook recipe sharing social platform.',
      );
      expect(config.info.description).toContain('accessToken');
      expect(config.info.description).toContain('refreshToken');
      expect(config.info.description).toContain('/uploads/');
      expect(config.info.description).toContain('LibreTranslate');
    });

    it('should configure both local and staging/production servers', () => {
      expect(config.servers).toHaveLength(2);
      expect(config.servers).toEqual([
        {
          url: 'http://localhost:3000',
          description: 'Local Development Server',
        },
        {
          url: 'https://app.we-cook.it:8443',
          description: 'Staging / Production Server',
        },
      ]);
    });

    it('should define all 8 canonical resource tags with exact descriptions', () => {
      const expectedTags = [
        {
          name: 'Auth',
          description:
            'User authentication, registration, session management, and two-factor authentication (2FA)',
        },
        {
          name: 'Users',
          description:
            'User accounts, public profiles, avatars, and liked recipes',
        },
        {
          name: 'Friends',
          description:
            'Bidirectional friendships, friend discovery, and friend request lifecycle management',
        },
        {
          name: 'Feed',
          description:
            'Personalized chronological social activity feed of recipes shared by confirmed friends',
        },
        {
          name: 'Recipes',
          description:
            'Recipe creation, localized details, pagination, step illustrations, media uploads, and likes',
        },
        {
          name: 'Catalog',
          description:
            'Curated ingredient catalogs, dietary tags, units of measure, and system metadata',
        },
        {
          name: 'Notifications',
          description:
            'User activity notifications, inbox management, and real-time alerts',
        },
        {
          name: 'System',
          description:
            'Health check, status probes, and system connectivity testing',
        },
      ];

      expect(config.tags).toHaveLength(8);
      expect(config.tags).toEqual(expectedTags);
    });

    it('should define cookie authentication schemes for session management', () => {
      expect(config.components).toBeDefined();
      expect(config.components?.securitySchemes).toBeDefined();

      const schemes = config.components?.securitySchemes as Record<string, any>;
      expect(schemes.cookie).toBeDefined();
      expect(schemes.cookie.type).toBe('apiKey');
      expect(schemes.cookie.in).toBe('cookie');
      expect(schemes.cookie.name).toBe('refreshToken');
      expect(schemes.cookie.description).toContain('refreshToken');

      // Verify that description documents both tokens
      expect(config.info.description).toContain(
        '- **`accessToken`**: Short-lived (10 minutes) JWT',
      );
      expect(config.info.description).toContain(
        '- **`refreshToken`**: Long-lived (7 days) JWT',
      );
    });
  });

  describe('setupSwagger', () => {
    it('should generate OpenAPI document and mount Swagger UI at api/docs with authorization persistence', () => {
      const mockDocument = { openapi: '3.0.0', paths: {} } as any;
      const createDocumentSpy = jest
        .spyOn(SwaggerModule, 'createDocument')
        .mockReturnValue(mockDocument);
      const setupSpy = jest.spyOn(SwaggerModule, 'setup').mockReturnValue();

      const mockApp = {} as unknown as INestApplication;
      const result = setupSwagger(mockApp);

      expect(createDocumentSpy).toHaveBeenCalledTimes(1);
      expect(createDocumentSpy).toHaveBeenCalledWith(
        mockApp,
        expect.objectContaining({
          openapi: '3.0.0',
          info: expect.objectContaining({ title: 'WeCook API' }),
        }),
      );

      expect(setupSpy).toHaveBeenCalledTimes(1);
      expect(setupSpy).toHaveBeenCalledWith('api/docs', mockApp, mockDocument, {
        swaggerOptions: {
          persistAuthorization: true,
        },
      });

      expect(result).toBe(mockDocument);

      createDocumentSpy.mockRestore();
      setupSpy.mockRestore();
    });
  });
});
