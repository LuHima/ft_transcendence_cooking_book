import { Injectable } from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';

export type RangeParseResult =
  | { start: number; end: number }
  | 'invalid'
  | null;

@Injectable()
export class MediaStreamingService {
  /**
   * Parses an RFC 9110 HTTP Range header against a known file size.
   * Supports:
   * - standard byte ranges: bytes=start-end
   * - open-ended ranges: bytes=start-
   * - suffix byte ranges: bytes=-suffixLength
   */
  parseRangeHeader(
    rangeHeader: string | undefined,
    fileSize: number,
  ): RangeParseResult {
    if (!rangeHeader || typeof rangeHeader !== 'string') {
      return null;
    }

    const trimmed = rangeHeader.trim();
    const match = trimmed.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) {
      return 'invalid';
    }

    const rawStart = match[1];
    const rawEnd = match[2];

    let start: number;
    let end: number;

    if (rawStart !== '' && rawEnd !== '') {
      // Standard range: bytes=start-end
      start = parseInt(rawStart, 10);
      end = parseInt(rawEnd, 10);
    } else if (rawStart !== '' && rawEnd === '') {
      // Open-ended range: bytes=start-
      start = parseInt(rawStart, 10);
      end = fileSize - 1;
    } else if (rawStart === '' && rawEnd !== '') {
      // Suffix range: bytes=-length
      const suffixLength = parseInt(rawEnd, 10);
      if (suffixLength <= 0) {
        return 'invalid';
      }
      start = Math.max(0, fileSize - suffixLength);
      end = fileSize - 1;
    } else {
      // bytes=- without numbers
      return 'invalid';
    }

    if (isNaN(start) || isNaN(end) || start > end || start >= fileSize) {
      return 'invalid';
    }

    // Clamp end boundary to fileSize - 1
    end = Math.min(end, fileSize - 1);

    return { start, end };
  }

  /**
   * Streams a video file supporting RFC 9110 HTTP 206 Partial Content byte ranges,
   * full 200 OK playback, and zero-payload HEAD requests.
   * Note: RFC 9110 §14.2 strictly forbids 206 responses to HEAD requests.
   */
  streamVideo(
    filePath: string,
    req: Request,
    res: Response,
    isHeadRequest = false,
  ): void {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const isWebm = filePath.toLowerCase().endsWith('.webm');
    const mimeType = isWebm ? 'video/webm' : 'video/mp4';

    // Standard headers
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('ETag', `W/"${stat.size}-${stat.mtimeMs}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');

    // RFC 9110 §14.2: Server MUST NOT generate a 206 response to a HEAD request
    if (isHeadRequest) {
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Type', mimeType);
      res.status(200);
      res.end();
      return;
    }

    const rangeHeader = req.headers.range;

    if (rangeHeader) {
      const parsedRange = this.parseRangeHeader(rangeHeader, fileSize);

      if (parsedRange === 'invalid' || parsedRange === null) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        res.status(416).end();
        return;
      }

      const { start, end } = parsedRange;
      const chunkSize = end - start + 1;

      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Type', mimeType);
      res.status(206);

      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => {
        if (!res.headersSent) {
          res.status(500).end();
        }
      });
      stream.pipe(res);
      return;
    }

    // Full video delivery without Range header
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', mimeType);
    res.status(200);

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    stream.pipe(res);
  }

  /**
   * Streams an image file with weak ETag conditional revalidation (304 Not Modified)
   * and standard security headers.
   */
  streamImage(
    filePath: string,
    req: Request,
    res: Response,
    isHeadRequest = false,
  ): void {
    const stat = fs.statSync(filePath);
    const etag = `W/"${stat.size}-${stat.mtimeMs}"`;

    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');

    // Conditional revalidation
    if (req?.headers?.['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    const lowerPath = filePath.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (lowerPath.endsWith('.webp')) mimeType = 'image/webp';
    else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg'))
      mimeType = 'image/jpeg';
    else if (lowerPath.endsWith('.png')) mimeType = 'image/png';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.status(200);

    if (isHeadRequest) {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end();
      }
    });
    stream.pipe(res);
  }
}
