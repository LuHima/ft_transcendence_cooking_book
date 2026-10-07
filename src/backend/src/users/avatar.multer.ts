import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { AVATAR_UPLOADS_DIR } from '../common/config/upload-paths';
export { AVATAR_UPLOADS_DIR } from '../common/config/upload-paths';

export const avatarStorage = diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(AVATAR_UPLOADS_DIR, { recursive: true });
    cb(null, AVATAR_UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    const ext = extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

export const avatarImageFilter = (
  req: any,
  file: { mimetype: string },
  cb: (error: any, acceptFile: boolean) => void,
) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(
      new BadRequestException(
        `Invalid file type. Only JPEG, PNG, and WEBP images are allowed. Received: ${file.mimetype}`,
      ),
      false,
    );
  }
  cb(null, true);
};

export const avatarMulterOptions = {
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: avatarImageFilter,
};
