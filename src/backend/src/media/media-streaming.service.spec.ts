import { MediaStreamingService } from './media-streaming.service';
import * as fs from 'fs';
import * as os from 'os';
import { join } from 'path';
import { PassThrough } from 'stream';
import { Request, Response } from 'express';

describe('MediaStreamingService', () => {
  let service: MediaStreamingService;
  let tempDir: string;
  let tempVideoPath: string;
  let tempWebmPath: string;
  let tempImagePath: string;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(join(os.tmpdir(), 'streaming-test-'));
    tempVideoPath = join(tempDir, 'sample.mp4');
    tempWebmPath = join(tempDir, 'sample.webm');
    tempImagePath = join(tempDir, 'sample.webp');
    fs.writeFileSync(tempVideoPath, Buffer.alloc(10000, 1));
    fs.writeFileSync(tempWebmPath, Buffer.alloc(5000, 2));
    fs.writeFileSync(tempImagePath, Buffer.alloc(1200, 3));
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    service = new MediaStreamingService();
  });

  describe('parseRangeHeader', () => {
    const fileSize = 1000;

    it('returns null if rangeHeader is undefined or empty', () => {
      expect(service.parseRangeHeader(undefined, fileSize)).toBeNull();
      expect(service.parseRangeHeader('', fileSize)).toBeNull();
    });

    it('parses standard range: bytes=start-end', () => {
      expect(service.parseRangeHeader('bytes=0-499', fileSize)).toEqual({
        start: 0,
        end: 499,
      });
      expect(service.parseRangeHeader('bytes=500-999', fileSize)).toEqual({
        start: 500,
        end: 999,
      });
    });

    it('parses open-ended range: bytes=start-', () => {
      expect(service.parseRangeHeader('bytes=500-', fileSize)).toEqual({
        start: 500,
        end: 999,
      });
      expect(service.parseRangeHeader('bytes=0-', fileSize)).toEqual({
        start: 0,
        end: 999,
      });
    });

    it('parses suffix range: bytes=-length', () => {
      expect(service.parseRangeHeader('bytes=-500', fileSize)).toEqual({
        start: 500,
        end: 999,
      });
      expect(service.parseRangeHeader('bytes=-100', fileSize)).toEqual({
        start: 900,
        end: 999,
      });
    });

    it('clamps suffix range when suffix length exceeds file size', () => {
      expect(service.parseRangeHeader('bytes=-1500', fileSize)).toEqual({
        start: 0,
        end: 999,
      });
    });

    it('clamps end boundary when end exceeds fileSize', () => {
      expect(service.parseRangeHeader('bytes=0-2000', fileSize)).toEqual({
        start: 0,
        end: 999,
      });
    });

    it('returns invalid when start >= fileSize', () => {
      expect(service.parseRangeHeader('bytes=1000-', fileSize)).toBe('invalid');
      expect(service.parseRangeHeader('bytes=1000-1500', fileSize)).toBe(
        'invalid',
      );
      expect(service.parseRangeHeader('bytes=1200-1300', fileSize)).toBe(
        'invalid',
      );
    });

    it('returns invalid when start > end', () => {
      expect(service.parseRangeHeader('bytes=500-400', fileSize)).toBe(
        'invalid',
      );
    });

    it('returns invalid on malformed syntax or suffix <= 0', () => {
      expect(service.parseRangeHeader('bytes=-0', fileSize)).toBe('invalid');
      expect(service.parseRangeHeader('bytes=-', fileSize)).toBe('invalid');
      expect(service.parseRangeHeader('notbytes=0-100', fileSize)).toBe(
        'invalid',
      );
      expect(service.parseRangeHeader('bytes=abc-def', fileSize)).toBe(
        'invalid',
      );
    });
  });

  describe('streamVideo', () => {
    let mockReq: Partial<Request>;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        headers: {},
      };
      mockRes = new PassThrough();
      mockRes.setHeader = jest.fn().mockReturnThis();
      mockRes.status = jest.fn().mockReturnThis();
    });

    it('streams 206 Partial Content for valid range request', (done) => {
      mockReq.headers = { range: 'bytes=0-4999' };

      const chunks: Buffer[] = [];
      mockRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      mockRes.on('finish', () => {
        expect(mockRes.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes');
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Cache-Control',
          'private, no-cache',
        );
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Range',
          'bytes 0-4999/10000',
        );
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 5000);
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'video/mp4',
        );
        expect(mockRes.status).toHaveBeenCalledWith(206);
        expect(Buffer.concat(chunks).length).toBe(5000);
        done();
      });

      service.streamVideo(tempVideoPath, mockReq as Request, mockRes as Response);
    });

    it('streams video/webm content type for webm files', (done) => {
      mockReq.headers = { range: 'bytes=0-100' };

      mockRes.on('finish', () => {
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'video/webm',
        );
        done();
      });

      service.streamVideo(tempWebmPath, mockReq as Request, mockRes as Response);
    });

    it('returns 416 Range Not Satisfiable when range is out of bounds', () => {
      mockReq.headers = { range: 'bytes=20000-30000' };

      service.streamVideo(tempVideoPath, mockReq as Request, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Range',
        'bytes */10000',
      );
      expect(mockRes.status).toHaveBeenCalledWith(416);
    });

    it('returns 200 OK and streams full file when Range header is omitted', (done) => {
      mockReq.headers = {};

      const chunks: Buffer[] = [];
      mockRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      mockRes.on('finish', () => {
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 10000);
        expect(mockRes.setHeader).toHaveBeenCalledWith(
          'Content-Type',
          'video/mp4',
        );
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(Buffer.concat(chunks).length).toBe(10000);
        done();
      });

      service.streamVideo(tempVideoPath, mockReq as Request, mockRes as Response);
    });

    it('returns 200 OK representation headers and ends response without piping for HEAD request (RFC 9110)', () => {
      mockReq.headers = { range: 'bytes=0-499' };

      service.streamVideo(
        tempVideoPath,
        mockReq as Request,
        mockRes as Response,
        true,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 10000);
      expect(mockRes.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes');
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('streamImage', () => {
    let mockReq: Partial<Request>;
    let mockRes: any;

    beforeEach(() => {
      mockReq = {
        headers: {},
      };
      mockRes = new PassThrough();
      mockRes.setHeader = jest.fn().mockReturnThis();
      mockRes.status = jest.fn().mockReturnThis();
    });

    it('streams image with correct Content-Type and 200 OK', (done) => {
      const chunks: Buffer[] = [];
      mockRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      mockRes.on('finish', () => {
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
        expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Length', 1200);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(Buffer.concat(chunks).length).toBe(1200);
        done();
      });

      service.streamImage(tempImagePath, mockReq as Request, mockRes as Response);
    });

    it('returns 304 Not Modified when ETag matches', () => {
      const endSpy = jest.spyOn(mockRes, 'end');
      const stat = fs.statSync(tempImagePath);
      const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
      mockReq.headers = { 'if-none-match': etag };

      service.streamImage(tempImagePath, mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(304);
      expect(endSpy).toHaveBeenCalled();
    });

    it('returns headers and ends response on HEAD request', () => {
      const endSpy = jest.spyOn(mockRes, 'end');
      service.streamImage(tempImagePath, mockReq as Request, mockRes as Response, true);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/webp');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(endSpy).toHaveBeenCalled();
    });
  });
});
