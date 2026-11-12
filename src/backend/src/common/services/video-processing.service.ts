import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { join } from 'path';
import { RECIPE_UPLOADS_DIR } from '../config/upload-paths';
import { ProcessedMediaResult } from './image-processing.service';

const VIDEO_TRANSCODE_TIMEOUT_MS = 120_000;

@Injectable()
export class VideoProcessingService {
  private readonly logger = new Logger(VideoProcessingService.name);

  /**
   * Synchronously transcodes an uploaded tutorial video to a streaming-optimized
   * H.264/AAC MP4 (max 1920x1080 horizontal / 1080x1920 vertical, CRF 27,
   * preset fast, +faststart) via FFmpeg.
   * Cleans up the raw multer input file upon completion or failure.
   */
  async processVideoFile(
    file: Express.Multer.File,
    recipeId: number,
  ): Promise<ProcessedMediaResult> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const inputPath = file.path;
    if (!inputPath) {
      throw new BadRequestException('Uploaded video file not found on disk');
    }

    try {
      await fs.promises.access(inputPath);
    } catch {
      throw new BadRequestException('Uploaded video file not found on disk');
    }

    await fs.promises.mkdir(RECIPE_UPLOADS_DIR, { recursive: true });
    const filename = `recipe-${Date.now()}-${randomUUID()}.mp4`;
    const outputPath = join(RECIPE_UPLOADS_DIR, filename);

    try {
      await this.runFfmpeg(inputPath, outputPath);
    } catch (err) {
      await fs.promises.unlink(outputPath).catch(() => {});
      throw err;
    } finally {
      await fs.promises.unlink(inputPath).catch(() => {});
    }

    return {
      filename,
      relativePath: `/api/media/recipes/${recipeId}/${filename}`,
    };
  }

  private runFfmpeg(inputPath: string, outputPath: string): Promise<void> {
    const args = [
      '-y',
      '-i',
      inputPath,
      '-vf',
      "scale='if(gte(iw,ih),min(1920,iw),min(1080,iw))':'if(gte(iw,ih),min(1080,ih),min(1920,ih))':force_original_aspect_ratio=decrease:force_divisible_by=2",
      '-c:v',
      'libx264',
      '-crf',
      '27',
      '-preset',
      'fast',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      outputPath,
    ];

    return new Promise((resolve, reject) => {
      const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderrOutput = '';
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        this.logger.warn(
          `FFmpeg transcode timed out after ${VIDEO_TRANSCODE_TIMEOUT_MS}ms for ${inputPath}`,
        );
        finish(() =>
          reject(
            new BadRequestException(
              'Video processing timed out: file took too long to transcode',
            ),
          ),
        );
      }, VIDEO_TRANSCODE_TIMEOUT_MS);

      child.stderr?.on('data', (chunk: Buffer) => {
        // Keep a rolling tail of the last 4096 chars so FFmpeg's final error line is preserved
        stderrOutput += chunk.toString();
        if (stderrOutput.length > 4096) {
          stderrOutput = stderrOutput.slice(-4096);
        }
      });

      child.on('error', (err) => {
        this.logger.error(`FFmpeg spawn error: ${err.message}`);
        finish(() =>
          reject(
            new InternalServerErrorException(
              'Video transcoding service unavailable',
            ),
          ),
        );
      });

      child.on('close', (code) => {
        if (code === 0) {
          finish(() => resolve());
          return;
        }
        this.logger.warn(
          `FFmpeg exited with code ${code}: ${stderrOutput.trim()}`,
        );
        finish(() =>
          reject(
            new BadRequestException(
              'Failed to process video: corrupt or unsupported file format',
            ),
          ),
        );
      });
    });
  }
}
