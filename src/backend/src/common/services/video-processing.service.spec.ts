import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import { VideoProcessingService } from './video-processing.service';
import { RECIPE_UPLOADS_DIR } from '../config/upload-paths';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

class MockChildProcess extends EventEmitter {
  stderr = new EventEmitter();
  kill = jest.fn();
}

describe('VideoProcessingService', () => {
  let service: VideoProcessingService;
  const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [VideoProcessingService],
    }).compile();

    service = module.get<VideoProcessingService>(VideoProcessingService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException when file is missing or not on disk', async () => {
    await expect(
      service.processVideoFile(undefined as unknown as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.processVideoFile({
        path: '/non-existent/video.mp4',
      } as Express.Multer.File),
    ).rejects.toThrow(BadRequestException);
  });

  it('should transcode video with expected FFmpeg flags and unlink raw input', async () => {
    const child = new MockChildProcess();
    mockSpawn.mockReturnValue(child as any);

    jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    const mkdirSpy = jest
      .spyOn(fs.promises, 'mkdir')
      .mockResolvedValue(undefined);
    const unlinkSpy = jest
      .spyOn(fs.promises, 'unlink')
      .mockResolvedValue(undefined);

    const inputPath = join(RECIPE_UPLOADS_DIR, 'raw-upload.mov');
    const mockFile = {
      path: inputPath,
      filename: 'raw-upload.mov',
      originalname: 'tutorial.mov',
      mimetype: 'video/quicktime',
    } as Express.Multer.File;

    const promise = service.processVideoFile(mockFile);

    // Wait a tick for mkdir and spawn to be called
    await Promise.resolve();
    await Promise.resolve();

    expect(mkdirSpy).toHaveBeenCalledWith(RECIPE_UPLOADS_DIR, {
      recursive: true,
    });
    expect(mockSpawn).toHaveBeenCalledTimes(1);

    const [cmd, args] = mockSpawn.mock.calls[0];
    expect(cmd).toBe('ffmpeg');
    expect(args).toEqual(
      expect.arrayContaining([
        '-y',
        '-i',
        inputPath,
        '-vf',
        "scale='min(1920,iw)':-2",
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
      ]),
    );

    const outputPath = args[args.length - 1];
    expect(outputPath).toMatch(/recipe-\d+-[a-f0-9-]+\.mp4$/);

    child.emit('close', 0);

    const result = await promise;
    expect(result.filename).toMatch(/^recipe-\d+-[a-f0-9-]+\.mp4$/);
    expect(result.relativePath).toBe(`/uploads/recipes/${result.filename}`);
    expect(unlinkSpy).toHaveBeenCalledWith(inputPath);
  });

  it('should unlink partial output and raw input and throw BadRequestException on non-zero exit', async () => {
    const child = new MockChildProcess();
    mockSpawn.mockReturnValue(child as any);

    jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    const unlinkSpy = jest
      .spyOn(fs.promises, 'unlink')
      .mockResolvedValue(undefined);

    const inputPath = join(RECIPE_UPLOADS_DIR, 'corrupt.mp4');
    const mockFile = { path: inputPath } as Express.Multer.File;

    const promise = service.processVideoFile(mockFile);
    await Promise.resolve();
    await Promise.resolve();

    const [, args] = mockSpawn.mock.calls[0];
    const outputPath = args[args.length - 1];

    child.stderr.emit('data', Buffer.from('Invalid data found when processing'));
    child.emit('close', 1);

    await expect(promise).rejects.toThrow(
      new BadRequestException(
        'Failed to process video: corrupt or unsupported file format',
      ),
    );
    expect(unlinkSpy).toHaveBeenCalledWith(outputPath);
    expect(unlinkSpy).toHaveBeenCalledWith(inputPath);
  });

  it('should handle FFmpeg spawn error event and clean up files', async () => {
    const child = new MockChildProcess();
    mockSpawn.mockReturnValue(child as any);

    jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    const unlinkSpy = jest
      .spyOn(fs.promises, 'unlink')
      .mockResolvedValue(undefined);

    const inputPath = join(RECIPE_UPLOADS_DIR, 'bad-spawn.mp4');
    const promise = service.processVideoFile({
      path: inputPath,
    } as Express.Multer.File);

    await Promise.resolve();
    await Promise.resolve();

    child.emit('error', new Error('ENOENT'));

    await expect(promise).rejects.toThrow(BadRequestException);
    expect(unlinkSpy).toHaveBeenCalledWith(inputPath);
  });

  it('should terminate FFmpeg with SIGKILL and clean up on 120s timeout', async () => {
    jest.useFakeTimers();
    const child = new MockChildProcess();
    mockSpawn.mockReturnValue(child as any);

    jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    const unlinkSpy = jest
      .spyOn(fs.promises, 'unlink')
      .mockResolvedValue(undefined);

    const inputPath = join(RECIPE_UPLOADS_DIR, 'slow-video.mp4');
    const promise = service.processVideoFile({
      path: inputPath,
    } as Express.Multer.File);

    await Promise.resolve();
    await Promise.resolve();

    const [, args] = mockSpawn.mock.calls[0];
    const outputPath = args[args.length - 1];

    jest.advanceTimersByTime(120_000);

    await expect(promise).rejects.toThrow(BadRequestException);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(unlinkSpy).toHaveBeenCalledWith(outputPath);
    expect(unlinkSpy).toHaveBeenCalledWith(inputPath);
  });
});
