import { Test, TestingModule } from '@nestjs/testing';
import { ImageProcessingService } from './image-processing.service';
import sharp from 'sharp';
import * as fs from 'fs';
import { join } from 'path';
import {
  AVATAR_UPLOADS_DIR,
  RECIPE_UPLOADS_DIR,
} from '../config/upload-paths';
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

  describe('processRecipeImageBuffer & processRecipeImageFile', () => {
    it('should downscale images exceeding 1920x1080 preserving aspect ratio, strip EXIF, and encode to webp', async () => {
      // Create a 3840x2160 (16:9) JPEG with EXIF metadata
      const largeBuffer = await sharp({
        create: {
          width: 2400,
          height: 1600, // 3:2 aspect ratio
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .withMetadata({ exif: { IFD0: { Copyright: 'Test EXIF' } } })
        .jpeg()
        .toBuffer();

      const result = await service.processRecipeImageBuffer(largeBuffer);
      expect(result.relativePath).toMatch(
        /^\/uploads\/recipes\/recipe-\d+-[a-f0-9-]+\.webp$/,
      );
      expect(result.filename.endsWith('.webp')).toBe(true);

      const fullPath = join(RECIPE_UPLOADS_DIR, result.filename);
      createdFiles.push(fullPath);
      expect(fs.existsSync(fullPath)).toBe(true);

      const metadata = await sharp(fullPath).metadata();
      expect(metadata.format).toBe('webp');
      // 2400x1600 (3:2) fitted inside 1920x1080 -> height-bound: 1620x1080
      expect(metadata.width).toBe(1620);
      expect(metadata.height).toBe(1080);
      expect(metadata.exif).toBeUndefined();
    });

    it('should not upscale images smaller than 1920x1080', async () => {
      const smallBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 50, g: 100, b: 150 },
        },
      })
        .png()
        .toBuffer();

      const result = await service.processRecipeImageBuffer(smallBuffer);
      const fullPath = join(RECIPE_UPLOADS_DIR, result.filename);
      createdFiles.push(fullPath);

      const metadata = await sharp(fullPath).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(800);
      expect(metadata.height).toBe(600);
    });

    it('should throw BadRequestException on empty or corrupt recipe image buffer', async () => {
      await expect(
        service.processRecipeImageBuffer(Buffer.alloc(0)),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.processRecipeImageBuffer(Buffer.from('corrupt-image-data')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file is missing in processRecipeImageFile', async () => {
      await expect(
        service.processRecipeImageFile(
          undefined as unknown as Express.Multer.File,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process disk-staged recipe image file and unlink temporary raw upload', async () => {
      await fs.promises.mkdir(RECIPE_UPLOADS_DIR, { recursive: true });
      const tempInputPath = join(
        RECIPE_UPLOADS_DIR,
        `temp-raw-${Date.now()}.jpg`,
      );
      const pngBuffer = await sharp({
        create: {
          width: 640,
          height: 480,
          channels: 3,
          background: { r: 20, g: 40, b: 60 },
        },
      })
        .jpeg()
        .toBuffer();
      await fs.promises.writeFile(tempInputPath, pngBuffer);

      const mockFile = {
        path: tempInputPath,
        filename: 'temp-raw.jpg',
        originalname: 'dish.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const result = await service.processRecipeImageFile(mockFile);
      expect(result.filename.endsWith('.webp')).toBe(true);
      expect(fs.existsSync(tempInputPath)).toBe(false);

      const fullPath = join(RECIPE_UPLOADS_DIR, result.filename);
      createdFiles.push(fullPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    });

    it('should unlink temporary raw disk file even when processing fails', async () => {
      await fs.promises.mkdir(RECIPE_UPLOADS_DIR, { recursive: true });
      const tempCorruptPath = join(
        RECIPE_UPLOADS_DIR,
        `temp-corrupt-${Date.now()}.jpg`,
      );
      await fs.promises.writeFile(tempCorruptPath, Buffer.from('not-an-image'));

      const mockFile = {
        path: tempCorruptPath,
        filename: 'temp-corrupt.jpg',
      } as Express.Multer.File;

      await expect(service.processRecipeImageFile(mockFile)).rejects.toThrow(
        BadRequestException,
      );
      expect(fs.existsSync(tempCorruptPath)).toBe(false);
    });
  });
});
