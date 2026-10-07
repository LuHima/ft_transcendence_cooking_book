import { isAbsolute, relative, resolve, join } from 'path';

const configuredUploadsDir = process.env.UPLOADS_DIR?.trim();

export const UPLOADS_DIR = configuredUploadsDir
  ? resolve(configuredUploadsDir)
  : resolve(process.cwd(), 'uploads');

export const RECIPE_UPLOADS_DIR = join(UPLOADS_DIR, 'recipes');

export function resolveStoredUploadPath(fileUrl: string): string | null {
  const normalizedUrl = fileUrl.startsWith('/') ? fileUrl.slice(1) : fileUrl;
  const uploadsPrefix = 'uploads/';

  if (!normalizedUrl.startsWith(uploadsPrefix)) return null;

  const absolutePath = resolve(
    UPLOADS_DIR,
    normalizedUrl.slice(uploadsPrefix.length),
  );
  const pathFromUploadsRoot = relative(UPLOADS_DIR, absolutePath);

  if (
    pathFromUploadsRoot.startsWith('..') ||
    isAbsolute(pathFromUploadsRoot)
  ) {
    return null;
  }

  return absolutePath;
}
