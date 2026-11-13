import { isAbsolute, relative, resolve, join } from 'path';

const configuredUploadsDir = process.env.UPLOADS_DIR?.trim();

export const UPLOADS_DIR = configuredUploadsDir
  ? resolve(configuredUploadsDir)
  : resolve(process.cwd(), 'uploads');

export const RECIPE_UPLOADS_DIR = join(UPLOADS_DIR, 'recipes');
export const AVATAR_UPLOADS_DIR = join(UPLOADS_DIR, 'avatars');

export function resolveStoredUploadPath(fileUrl: string): string | null {
  if (!fileUrl || typeof fileUrl !== 'string') return null;

  const trimmed = fileUrl.trim();
  if (!trimmed) return null;

  // External URLs (e.g. Unsplash, Google OAuth, S3, etc.) are not local uploads
  if (/^https?:\/\//i.test(trimmed)) return null;

  const normalizedUrl = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;

  // 1. Canonical Recipe Media: api/media/recipes/:recipeId/:filename
  const recipeMatch = normalizedUrl.match(/^api\/media\/recipes\/[^\/]+\/(.+)$/);
  if (recipeMatch) {
    const rawFilename = recipeMatch[1];
    // Reject path traversal tokens
    if (
      rawFilename.includes('..') ||
      rawFilename.includes('/') ||
      rawFilename.includes('\\')
    ) {
      return null;
    }
    const absolutePath = resolve(RECIPE_UPLOADS_DIR, rawFilename);
    const pathFromRecipeRoot = relative(RECIPE_UPLOADS_DIR, absolutePath);
    if (
      pathFromRecipeRoot.startsWith('..') ||
      isAbsolute(pathFromRecipeRoot) ||
      pathFromRecipeRoot.includes('..')
    ) {
      return null;
    }
    return absolutePath;
  }

  // 2. Canonical Avatar Media: api/media/avatars/:userId/:filename
  const avatarMatch = normalizedUrl.match(/^api\/media\/avatars\/[^\/]+\/(.+)$/);
  if (avatarMatch) {
    const rawFilename = avatarMatch[1];
    if (
      rawFilename.includes('..') ||
      rawFilename.includes('/') ||
      rawFilename.includes('\\')
    ) {
      return null;
    }
    const absolutePath = resolve(AVATAR_UPLOADS_DIR, rawFilename);
    const pathFromAvatarRoot = relative(AVATAR_UPLOADS_DIR, absolutePath);
    if (
      pathFromAvatarRoot.startsWith('..') ||
      isAbsolute(pathFromAvatarRoot) ||
      pathFromAvatarRoot.includes('..')
    ) {
      return null;
    }
    return absolutePath;
  }

  // 3. Legacy uploads: uploads/...
  const uploadsPrefix = 'uploads/';
  if (normalizedUrl.startsWith(uploadsPrefix)) {
    const relativeSubPath = normalizedUrl.slice(uploadsPrefix.length);
    if (relativeSubPath.includes('..')) {
      return null;
    }
    const absolutePath = resolve(UPLOADS_DIR, relativeSubPath);
    const pathFromUploadsRoot = relative(UPLOADS_DIR, absolutePath);
    if (
      pathFromUploadsRoot.startsWith('..') ||
      isAbsolute(pathFromUploadsRoot) ||
      pathFromUploadsRoot.includes('..')
    ) {
      return null;
    }
    return absolutePath;
  }

  return null;
}
