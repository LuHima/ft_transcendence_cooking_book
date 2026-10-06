import { BadRequestException } from '@nestjs/common';
import {
  recipeImageFilter,
  recipeVideoFilter,
  recipeImageMulterOptions,
  recipeVideoMulterOptions,
} from './recipe-media.multer';

describe('RecipeMediaMulter', () => {
  describe('recipeImageFilter', () => {
    it('accepts valid image MIME types (jpeg, png, webp)', () => {
      const cb = jest.fn();
      recipeImageFilter({}, { mimetype: 'image/jpeg' } as any, cb);
      expect(cb).toHaveBeenCalledWith(null, true);

      cb.mockClear();
      recipeImageFilter({}, { mimetype: 'image/png' } as any, cb);
      expect(cb).toHaveBeenCalledWith(null, true);

      cb.mockClear();
      recipeImageFilter({}, { mimetype: 'image/webp' } as any, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('rejects unsupported MIME types with BadRequestException', () => {
      const cb = jest.fn();
      recipeImageFilter({}, { mimetype: 'application/pdf' } as any, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(BadRequestException), false);

      cb.mockClear();
      recipeImageFilter({}, { mimetype: 'video/mp4' } as any, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });
  });

  describe('recipeVideoFilter', () => {
    it('accepts valid video MIME types (mp4, webm, quicktime)', () => {
      const cb = jest.fn();
      recipeVideoFilter({}, { mimetype: 'video/mp4' } as any, cb);
      expect(cb).toHaveBeenCalledWith(null, true);

      cb.mockClear();
      recipeVideoFilter({}, { mimetype: 'video/webm' } as any, cb);
      expect(cb).toHaveBeenCalledWith(null, true);

      cb.mockClear();
      recipeVideoFilter({}, { mimetype: 'video/quicktime' } as any, cb);
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    it('rejects unsupported video MIME types with BadRequestException', () => {
      const cb = jest.fn();
      recipeVideoFilter({}, { mimetype: 'image/jpeg' } as any, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(BadRequestException), false);

      cb.mockClear();
      recipeVideoFilter({}, { mimetype: 'audio/mp3' } as any, cb);
      expect(cb).toHaveBeenCalledWith(expect.any(BadRequestException), false);
    });
  });

  describe('limits', () => {
    it('enforces 10MB limit for images and 100MB for video', () => {
      expect(recipeImageMulterOptions.limits.fileSize).toBe(10 * 1024 * 1024);
      expect(recipeVideoMulterOptions.limits.fileSize).toBe(100 * 1024 * 1024);
    });
  });
});
