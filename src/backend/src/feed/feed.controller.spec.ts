/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { JwtService } from '@nestjs/jwt';
import { FeedQueryDto } from './dto/feed-query.dto';
import { PaginatedRecipeResponseDto } from '../recipe/dto/recipe-response.dto';

describe('FeedController', () => {
  let controller: FeedController;
  let service: FeedService;
  let app: INestApplication<App>;

  const mockResponse: PaginatedRecipeResponseDto = {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    total_pages: 0,
    has_next_page: false,
    has_prev_page: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeedController],
      providers: [
        {
          provide: FeedService,
          useValue: {
            getFeed: jest.fn().mockResolvedValue(mockResponse),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FeedController>(FeedController);
    service = module.get<FeedService>(FeedService);

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Unit: getFeed delegation', () => {
    it('delegates to feedService.getFeed with userId and query', async () => {
      const query: FeedQueryDto = { page: 1, limit: 20, lang: 'it' };
      const result = await controller.getFeed(42, query);

      expect(service.getFeed).toHaveBeenCalledWith(42, query);
      expect(result).toEqual(mockResponse);
    });
  });

  describe('Integration / Guard Enforcement', () => {
    it('rejects unauthenticated requests to GET /api/feed with 401 Unauthorized', async () => {
      await request(app.getHttpServer()).get('/api/feed').expect(401);

      expect(service.getFeed).not.toHaveBeenCalled();
    });

    it('allows authenticated requests with valid accessToken cookie', async () => {
      const jwtService = app.get<JwtService>(JwtService);
      (jwtService.verifyAsync as jest.Mock<any>).mockResolvedValue({
        sub: 42,
        type: 'access',
      });

      const response = await request(app.getHttpServer())
        .get('/api/feed?page=1&limit=20&lang=it')
        .set('Cookie', ['accessToken=valid-jwt-token'])
        .expect(200);

      expect(service.getFeed).toHaveBeenCalledWith(
        42,
        expect.objectContaining({ page: 1, limit: 20, lang: 'it' }),
      );
      expect(response.body).toEqual(mockResponse);
    });

    it('rejects requests with invalid query parameters with 400 Bad Request', async () => {
      const jwtService = app.get<JwtService>(JwtService);
      (jwtService.verifyAsync as jest.Mock<any>).mockResolvedValue({
        sub: 42,
        type: 'access',
      });

      await request(app.getHttpServer())
        .get('/api/feed?lang=invalid_locale')
        .set('Cookie', ['accessToken=valid-jwt-token'])
        .expect(400);

      expect(service.getFeed).not.toHaveBeenCalled();
    });
  });
});
