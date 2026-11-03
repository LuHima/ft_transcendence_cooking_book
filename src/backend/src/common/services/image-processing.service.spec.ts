import { Test, TestingModule } from '@nestjs/testing';
import { ImageProcessingService } from './image-processing.service';
import sharp from 'sharp';
import * as fs from 'fs';
import { join } from 'path';
import { AVATAR_UPLOADS_DIR } from '../config/upload-paths';
import { BadRequestException } from '@nestjs/common';

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;
  const createdFiles: string[] = [];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ImageProcessingService],
    }).compile();

    service = module.get<ImageProcessingService>(ImageProcessingService);
  });

  afterAll(async () => {
    for (const file of createdFiles) {
      if (fs.existsSync(file)) {
        await fs.promises.unlink(file).catch(() => {});
      }
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should transcode image buffer to 512x512 webp and strip EXIF metadata', async () => {
    // Create a 200x100 sample PNG buffer
    const testPngBuffer = await sharp({
      create: {
        width: 200,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await service.processAvatarBuffer(testPngBuffer);
    expect(result.relativePath).toMatch(
      /^\/uploads\/avatars\/avatar-\d+-[a-f0-9-]+\.webp$/,
    );
    expect(result.filename.endsWith('.webp')).toBe(true);

    const fullPath = join(AVATAR_UPLOADS_DIR, result.filename);
    createdFiles.push(fullPath);
    expect(fs.existsSync(fullPath)).toBe(true);

    const metadata = await sharp(fullPath).metadata();
    expect(metadata.format).toBe('webp');
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.exif).toBeUndefined();
  });

  it('should throw BadRequestException on corrupt image buffer', async () => {
    const corruptBuffer = Buffer.from('not an image at all');
    await expect(service.processAvatarBuffer(corruptBuffer)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should process avatar file with buffer attached', async () => {
    const testPngBuffer = await sharp({
      create: {
        width: 150,
        height: 150,
        channels: 3,
        background: { r: 0, g: 255, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const mockFile = {
      buffer: testPngBuffer,
      originalname: 'test.jpg',
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    const result = await service.processAvatarFile(mockFile);
    expect(result.relativePath).toMatch(
      /^\/uploads\/avatars\/avatar-\d+-[a-f0-9-]+\.webp$/,
    );
    createdFiles.push(join(AVATAR_UPLOADS_DIR, result.filename));
  });

  it('should fallback gracefully when neither buffer nor file path exists', async () => {
    const mockFile = {
      filename: 'fallback-avatar.jpg',
    } as Express.Multer.File;

    const result = await service.processAvatarFile(mockFile);
    expect(result.relativePath).toBe('/uploads/avatars/fallback-avatar.jpg');
  });
});
