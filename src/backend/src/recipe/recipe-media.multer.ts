import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

export const RECIPE_UPLOADS_DIR = 'uploads/recipes';

export const recipeImageStorage = diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(RECIPE_UPLOADS_DIR, { recursive: true });
    cb(null, RECIPE_UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    const ext = extname(file.originalname);
    cb(null, `recipe-${uniqueSuffix}${ext}`);
  },
});

export const recipeImageFilter = (
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

export const recipeVideoFilter = (
  req: any,
  file: { mimetype: string },
  cb: (error: any, acceptFile: boolean) => void,
) => {
  const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(
      new BadRequestException(
        `Invalid file type. Only MP4, WebM, and MOV videos are allowed. Received: ${file.mimetype}`,
      ),
      false,
    );
  }
  cb(null, true);
};

export const recipeImageMulterOptions = {
  storage: recipeImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: recipeImageFilter,
};

export const recipeVideoMulterOptions = {
  storage: recipeImageStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: recipeVideoFilter,
};
