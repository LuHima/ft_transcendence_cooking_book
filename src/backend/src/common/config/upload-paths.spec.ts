import { join } from 'path';
import {
  resolveStoredUploadPath,
  RECIPE_UPLOADS_DIR,
  AVATAR_UPLOADS_DIR,
  UPLOADS_DIR,
} from './upload-paths';

describe('upload-paths', () => {
  describe('resolveStoredUploadPath', () => {
    it('resolves canonical recipe media paths to RECIPE_UPLOADS_DIR', () => {
      const url = '/api/media/recipes/42/cover-image.webp';
      const expected = join(RECIPE_UPLOADS_DIR, 'cover-image.webp');
      expect(resolveStoredUploadPath(url)).toBe(expected);
    });

    it('resolves canonical avatar media paths to AVATAR_UPLOADS_DIR', () => {
      const url = '/api/media/avatars/7/avatar_7.webp';
      const expected = join(AVATAR_UPLOADS_DIR, 'avatar_7.webp');
      expect(resolveStoredUploadPath(url)).toBe(expected);
    });

    it('resolves paths without leading slashes', () => {
      const recipeUrl = 'api/media/recipes/1/step-1.jpg';
      expect(resolveStoredUploadPath(recipeUrl)).toBe(
        join(RECIPE_UPLOADS_DIR, 'step-1.jpg'),
      );

      const avatarUrl = 'api/media/avatars/1/avatar.png';
      expect(resolveStoredUploadPath(avatarUrl)).toBe(
        join(AVATAR_UPLOADS_DIR, 'avatar.png'),
      );
    });

    it('resolves legacy /uploads/recipes paths to RECIPE_UPLOADS_DIR', () => {
      const legacyRecipe = '/uploads/recipes/carbonara.webp';
      expect(resolveStoredUploadPath(legacyRecipe)).toBe(
        join(RECIPE_UPLOADS_DIR, 'carbonara.webp'),
      );
    });

    it('resolves legacy /uploads/avatars paths to AVATAR_UPLOADS_DIR', () => {
      const legacyAvatar = '/uploads/avatars/mario.webp';
      expect(resolveStoredUploadPath(legacyAvatar)).toBe(
        join(AVATAR_UPLOADS_DIR, 'mario.webp'),
      );
    });

    it('resolves legacy /uploads generic paths to UPLOADS_DIR', () => {
      const legacyGeneric = '/uploads/other/sample.txt';
      expect(resolveStoredUploadPath(legacyGeneric)).toBe(
        join(UPLOADS_DIR, 'other', 'sample.txt'),
      );
    });

    it('rejects directory traversal attempts in canonical recipe media paths', () => {
      expect(
        resolveStoredUploadPath('/api/media/recipes/42/../../etc/passwd'),
      ).toBeNull();
      expect(
        resolveStoredUploadPath('/api/media/recipes/42/..%2F..%2Fetc%2Fpasswd'),
      ).toBeNull();
    });

    it('rejects directory traversal attempts in canonical avatar media paths', () => {
      expect(
        resolveStoredUploadPath('/api/media/avatars/7/../../etc/shadow'),
      ).toBeNull();
    });

    it('rejects directory traversal attempts in legacy uploads paths', () => {
      expect(resolveStoredUploadPath('/uploads/../../etc/passwd')).toBeNull();
      expect(
        resolveStoredUploadPath('/uploads/recipes/../../secret.key'),
      ).toBeNull();
    });

    it('rejects external HTTP/HTTPS URLs', () => {
      expect(
        resolveStoredUploadPath(
          'https://images.unsplash.com/photo-123?auto=format',
        ),
      ).toBeNull();
      expect(
        resolveStoredUploadPath('http://localhost:3000/api/media/recipes/1/pic.jpg'),
      ).toBeNull();
    });

    it('rejects empty, null, or invalid input', () => {
      expect(resolveStoredUploadPath('')).toBeNull();
      expect(resolveStoredUploadPath('   ')).toBeNull();
      expect(resolveStoredUploadPath(null as any)).toBeNull();
      expect(resolveStoredUploadPath(undefined as any)).toBeNull();
      expect(resolveStoredUploadPath('/api/recipes/42')).toBeNull();
    });
  });
});
