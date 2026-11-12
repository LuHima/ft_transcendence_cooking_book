import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { join } from 'path';
import {
  AVATAR_UPLOADS_DIR,
  RECIPE_UPLOADS_DIR,
} from '../config/upload-paths';

export interface ProcessedMediaResult {
  filename: string;
  relativePath: string;
}

interface WebpProcessingOptions {
  dir: string;
  prefix: string;
  canonicalUrlPrefix: string;
  width: number;
  height: number;
  resizeOptions: sharp.ResizeOptions;
  errorLabel: string;
}

@Injectable()
export class ImageProcessingService {
  /**
   * Processes a raw avatar image buffer:
   * - Strips all EXIF metadata for privacy protection
   * - Center-crops and resizes to 512x512
   * - Encodes to WebP format at 80% quality
   * - Persists into AVATAR_UPLOADS_DIR with a collision-resistant filename
   */
  async processAvatarBuffer(
    buffer: Buffer,
    userId: number,
  ): Promise<ProcessedMediaResult> {
    return this.processWebpBuffer(buffer, {
      dir: AVATAR_UPLOADS_DIR,
      prefix: 'avatar',
      canonicalUrlPrefix: `/api/media/avatars/${userId}`,
      width: 512,
      height: 512,
      resizeOptions: { fit: 'cover', position: 'center' },
      errorLabel: 'avatar image',
    });
  }

  /**
   * Processes an uploaded avatar file (from memory buffer or disk storage).
   */
  async processAvatarFile(
    file: Express.Multer.File,
    userId: number,
  ): Promise<ProcessedMediaResult> {
    return this.processImageFile(file, (buffer) =>
      this.processAvatarBuffer(buffer, userId),
    );
  }

  /**
   * Processes a raw recipe image buffer (cover, step illustration, or gallery):
   * - Strips all EXIF metadata via .rotate()
   * - Downscales to fit within 1920x1080 preserving aspect ratio without upscaling
   * - Encodes to WebP format at 80% quality
   * - Persists into RECIPE_UPLOADS_DIR with a collision-resistant filename
   */
  async processRecipeImageBuffer(
    buffer: Buffer,
    recipeId: number,
  ): Promise<ProcessedMediaResult> {
    return this.processWebpBuffer(buffer, {
      dir: RECIPE_UPLOADS_DIR,
      prefix: 'recipe',
      canonicalUrlPrefix: `/api/media/recipes/${recipeId}`,
      width: 1920,
      height: 1080,
      resizeOptions: { fit: 'inside', withoutEnlargement: true },
      errorLabel: 'recipe image',
    });
  }

  /**
   * Processes an uploaded recipe image file (from memory buffer or disk storage)
   * and unlinks any temporary raw multer file on disk.
   */
  async processRecipeImageFile(
    file: Express.Multer.File,
    recipeId: number,
  ): Promise<ProcessedMediaResult> {
    return this.processImageFile(file, (buffer) =>
      this.processRecipeImageBuffer(buffer, recipeId),
    );
  }

  private async processWebpBuffer(
    buffer: Buffer,
    options: WebpProcessingOptions,
  ): Promise<ProcessedMediaResult> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Empty image buffer provided');
    }

    await fs.promises.mkdir(options.dir, { recursive: true });
    const filename = `${options.prefix}-${Date.now()}-${randomUUID()}.webp`;
    const outputPath = join(options.dir, filename);

    try {
      await sharp(buffer)
        .rotate()
        .resize(options.width, options.height, options.resizeOptions)
        .webp({ quality: 80 })
        .toFile(outputPath);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Invalid image format';
      throw new BadRequestException(
        `Failed to process ${options.errorLabel}: ${errorMsg}`,
      );
    }

    return {
      filename,
      relativePath: `${options.canonicalUrlPrefix}/${filename}`,
    };
  }

  private async processImageFile(
    file: Express.Multer.File,
    processBuffer: (buffer: Buffer) => Promise<ProcessedMediaResult>,
  ): Promise<ProcessedMediaResult> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.buffer !== undefined) {
      if (file.buffer.length === 0 && !file.path) {
        throw new BadRequestException('Empty image buffer provided');
      }
      if (file.buffer.length > 0) {
        try {
          return await processBuffer(file.buffer);
        } finally {
          if (file.path) {
            await fs.promises.unlink(file.path).catch(() => {});
          }
        }
      }
    }

    if (!file.path) {
      throw new BadRequestException('Uploaded image file has no content');
    }

    try {
      await fs.promises.access(file.path);
    } catch {
      throw new BadRequestException('Uploaded image file not found on disk');
    }

    try {
      const buffer = await fs.promises.readFile(file.path);
      return await processBuffer(buffer);
    } finally {
      await fs.promises.unlink(file.path).catch(() => {});
    }
  }
}
