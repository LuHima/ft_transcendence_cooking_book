import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  CanActivate,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import sharp from 'sharp';
import * as fs from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../src/common/guards/auth.guard';
import { OptionalAuthGuard } from '../src/common/guards/optional-auth.guard';
import { RECIPE_UPLOADS_DIR } from '../src/common/config/upload-paths';
import { RecipePrivacy, MediaType } from '@prisma/client';

class MockAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 1, role: 'user' };
    return true;
  }
}

describe('Recipe Media Optimization & Retrieval (e2e)', () => {
  let app: INestApplication<App>;
  const createdFiles: string[] = [];

  const recipeStore = {
    id: 1,
    user_id: 1,
    privacy: RecipePrivacy.public,
    cover_image_url: null as string | null,
    video_url: null as string | null,
  };

  const stepStore = {
    id: 10,
    recipe_id: 1,
    step_number: 1,
    image_url: null as string | null,
  };

  const galleryStore: Array<{
    id: number;
    recipe_id: number;
    url: string;
    media_type: MediaType;
    order: number;
  }> = [];

  const mockPrisma = {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    recipe: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.id !== recipeStore.id) return null;
        return {
          ...recipeStore,
          steps: [{ ...stepStore }],
          recipe_media: [...galleryStore],
        };
      }),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(recipeStore, data);
        return { ...recipeStore };
      }),
    },
    recipeStep: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (
          where?.recipe_id === stepStore.recipe_id &&
          where?.step_number === stepStore.step_number
        ) {
          return { ...stepStore };
        }
        return null;
      }),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(stepStore, data);
        return { ...stepStore };
      }),
    },
    recipeMedia: {
      findMany: jest.fn(async () => [...galleryStore]),
      create: jest.fn(async ({ data }: any) => {
        const item = { id: galleryStore.length + 1, ...data };
        galleryStore.push(item);
        return item;
      }),
    },
    userBlock: {
      findFirst: jest.fn(async () => null),
    },
  };

  const trackUrlFile = (url: string) => {
    const filename = url.split('/').pop();
    if (filename) {
      createdFiles.push(join(RECIPE_UPLOADS_DIR, filename));
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideGuard(AuthGuard)
      .useClass(MockAuthGuard)
      .overrideGuard(OptionalAuthGuard)
      .useClass(MockAuthGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    for (const filePath of createdFiles) {
      await fs.promises.unlink(filePath).catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  it('POST /api/recipes/1/cover transcodes to WebP and GET /api/media/recipes/1/:filename serves it', async () => {
    const jpegBuffer = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 3,
        background: { r: 180, g: 90, b: 40 },
      },
    })
      .jpeg()
      .toBuffer();

    const uploadRes = await request(app.getHttpServer())
      .post('/api/recipes/1/cover')
      .attach('file', jpegBuffer, {
        filename: 'cover.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    const coverUrl: string = uploadRes.body.cover_image_url;
    expect(coverUrl).toMatch(/^\/api\/media\/recipes\/1\/recipe-.*\.webp$/);
    trackUrlFile(coverUrl);

    const mediaRes = await request(app.getHttpServer())
      .get(coverUrl)
      .expect(200);

    expect(mediaRes.headers['content-type']).toContain('image/webp');
    const meta = await sharp(mediaRes.body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1620);
    expect(meta.height).toBe(1080);
  });

  it('POST /api/recipes/1/steps/1/image transcodes to WebP and serves via MediaController', async () => {
    const pngBuffer = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 20, g: 120, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const uploadRes = await request(app.getHttpServer())
      .post('/api/recipes/1/steps/1/image')
      .attach('file', pngBuffer, {
        filename: 'step1.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(uploadRes.body.step_number).toBe(1);
    const imageUrl: string = uploadRes.body.image_url;
    expect(imageUrl).toMatch(/^\/api\/media\/recipes\/1\/recipe-.*\.webp$/);
    trackUrlFile(imageUrl);

    await request(app.getHttpServer())
      .get(imageUrl)
      .expect(200)
      .expect('Content-Type', /image\/webp/);
  });

  it('POST /api/recipes/1/gallery transcodes batch to WebP and serves via MediaController', async () => {
    const imgA = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();
    const imgB = await sharp({
      create: {
        width: 500,
        height: 500,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .png()
      .toBuffer();

    const uploadRes = await request(app.getHttpServer())
      .post('/api/recipes/1/gallery')
      .attach('files', imgA, { filename: 'g1.jpg', contentType: 'image/jpeg' })
      .attach('files', imgB, { filename: 'g2.png', contentType: 'image/png' })
      .expect(201);

    expect(uploadRes.body).toHaveLength(2);
    for (const item of uploadRes.body) {
      expect(item.url).toMatch(/^\/api\/media\/recipes\/1\/recipe-.*\.webp$/);
      trackUrlFile(item.url);
      await request(app.getHttpServer())
        .get(item.url)
        .expect(200)
        .expect('Content-Type', /image\/webp/);
    }
  });

  it('POST /api/recipes/1/video compresses vertical video to 1080x1920 MP4 with faststart and streams 206 Partial Content', async () => {
    const tempVideoPath = join(RECIPE_UPLOADS_DIR, `e2e-input-${Date.now()}.mp4`);
    await fs.promises.mkdir(RECIPE_UPLOADS_DIR, { recursive: true });
    createdFiles.push(tempVideoPath);

    // Generate a 1-second vertical 1280x2560 test video using FFmpeg
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=1280x2560:rate=10:duration=1',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        tempVideoPath,
      ],
      { stdio: 'ignore' },
    );

    const uploadRes = await request(app.getHttpServer())
      .post('/api/recipes/1/video')
      .attach('file', tempVideoPath, {
        filename: 'vertical.mp4',
        contentType: 'video/mp4',
      })
      .expect(201);

    const videoUrl: string = uploadRes.body.video_url;
    expect(videoUrl).toMatch(/^\/api\/media\/recipes\/1\/recipe-.*\.mp4$/);
    trackUrlFile(videoUrl);

    const outputFilename = videoUrl.split('/').pop()!;
    const outputFilePath = join(RECIPE_UPLOADS_DIR, outputFilename);
    const probeDimensions = execFileSync('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=s=x:p=0',
      outputFilePath,
    ])
      .toString()
      .trim();
    // 1280x2560 fitted inside vertical 1080x1920 -> 960x1920
    expect(probeDimensions).toBe('960x1920');

    const streamRes = await request(app.getHttpServer())
      .get(videoUrl)
      .set('Range', 'bytes=0-255')
      .expect(206);

    expect(streamRes.headers['accept-ranges']).toBe('bytes');
    expect(streamRes.headers['content-type']).toContain('video/mp4');
    expect(streamRes.headers['content-range']).toMatch(/^bytes 0-255\/\d+$/);
  });
});
