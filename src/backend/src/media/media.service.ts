import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaStreamingService } from './media-streaming.service';
import {
  RECIPE_UPLOADS_DIR,
  AVATAR_UPLOADS_DIR,
} from '../common/config/upload-paths';
import { ActiveUserData } from '../common/decorators/current-user.decorator';
import { RecipePrivacy, Role } from '@prisma/client';
import { Request, Response } from 'express';
import * as fs from 'fs';
import { join } from 'path';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaStreamingService: MediaStreamingService,
  ) {}

  public logAudit(
    event:
      | 'ADMIN_PRIVATE_RECIPE_INSPECT'
      | 'MODERATOR_PRIVATE_RECIPE_CONTEXT_INSPECT',
    details: { userId?: number; recipeId: number; reportId?: number },
  ): void {
    this.logger.log(
      `[${event}] User #${details.userId} inspected private recipe #${details.recipeId}${
        details.reportId ? ` for report #${details.reportId}` : ''
      }`,
    );
  }

  /**
   * Serves protected recipe media assets (covers, step photos, gallery, video)
   * enforcing filename sanitization, database asset linkage, mutual user blocks,
   * recipe privacy tiers, ETag revalidation, and video streaming.
   */
  async getRecipeMedia(
    recipeId: number,
    filename: string,
    currentUser?: ActiveUserData,
    req?: Request,
    res?: Response,
    isHeadRequest = false,
  ): Promise<void> {
    // 1. Strict filename sanitization
    const validRecipeFileRegex =
      /^[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png|mp4|webm)$/i;
    if (!filename || !validRecipeFileRegex.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }

    // 2. Database asset linkage check
    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        steps: { select: { image_url: true } },
        recipe_media: { select: { url: true } },
      },
    });

    if (!recipe) {
      throw new NotFoundException('Recipe not found');
    }

    const isLinked =
      Boolean(
        recipe.cover_image_url &&
          (recipe.cover_image_url.endsWith('/' + filename) ||
            recipe.cover_image_url.endsWith(filename)),
      ) ||
      Boolean(
        recipe.video_url &&
          (recipe.video_url.endsWith('/' + filename) ||
            recipe.video_url.endsWith(filename)),
      ) ||
      recipe.steps.some(
        (s) =>
          s.image_url &&
          (s.image_url.endsWith('/' + filename) ||
            s.image_url.endsWith(filename)),
      ) ||
      recipe.recipe_media.some(
        (m) =>
          m.url &&
          (m.url.endsWith('/' + filename) || m.url.endsWith(filename)),
      );

    if (!isLinked) {
      throw new NotFoundException('Media not found');
    }

    const currentUserId = currentUser?.id;
    const currentUserRole = currentUser?.role;
    const isAuthor =
      currentUserId !== undefined && currentUserId === recipe.user_id;
    const isStaff =
      currentUserRole === Role.admin || currentUserRole === Role.moderator;

    // 3. Mutual user block invariant
    if (currentUserId && recipe.user_id && currentUserId !== recipe.user_id) {
      const block = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blocker_id: currentUserId, blocked_id: recipe.user_id },
            { blocker_id: recipe.user_id, blocked_id: currentUserId },
          ],
        },
      });
      if (block) {
        throw new NotFoundException('Recipe not found');
      }
    }

    // 4. Recipe Privacy Access Control
    const privacy = recipe.privacy ?? RecipePrivacy.public;

    if (privacy === RecipePrivacy.private) {
      if (isAuthor) {
        // Author allowed
      } else if (currentUserRole === Role.admin) {
        this.logAudit('ADMIN_PRIVATE_RECIPE_INSPECT', {
          userId: currentUserId,
          recipeId: recipe.id,
        });
      } else if (currentUserRole === Role.moderator) {
        let hasActiveReport: any = null;
        if (this.prisma.report) {
          const recipeComments = this.prisma.comment
            ? await this.prisma.comment.findMany({
                where: { recipe_id: recipe.id },
                select: { id: true },
              })
            : [];
          const commentIds = recipeComments.map((c) => c.id);

          hasActiveReport = await this.prisma.report.findFirst({
            where: {
              status: 'pending',
              OR: [
                { subject: 'recipe', target_id: recipe.id },
                ...(commentIds.length > 0
                  ? [
                      {
                        subject: 'comment' as const,
                        target_id: { in: commentIds },
                      },
                    ]
                  : []),
              ],
            },
          });
        }
        if (hasActiveReport) {
          this.logAudit('MODERATOR_PRIVATE_RECIPE_CONTEXT_INSPECT', {
            userId: currentUserId,
            recipeId: recipe.id,
            reportId: hasActiveReport.id,
          });
        } else {
          throw new NotFoundException('Recipe not found');
        }
      } else {
        throw new NotFoundException('Recipe not found');
      }
    } else if (privacy === RecipePrivacy.friends_only) {
      if (!currentUserId) {
        throw new UnauthorizedException('Unauthorized');
      }
      if (isAuthor || isStaff) {
        // Author and staff allowed
      } else {
        let isFriend = false;
        if (this.prisma.friendship && recipe.user_id) {
          const friendship = await this.prisma.friendship.findFirst({
            where: {
              status: 'accepted',
              OR: [
                { requester_id: currentUserId, addressee_id: recipe.user_id },
                { requester_id: recipe.user_id, addressee_id: currentUserId },
              ],
            },
          });
          isFriend = Boolean(friendship);
        }
        if (!isFriend) {
          throw new ForbiddenException(
            'This recipe is only visible to confirmed friends of the author',
          );
        }
      }
    }

    // 5. Physical file verification
    const filePath = join(RECIPE_UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const stat = fs.statSync(filePath);
    const etag = `W/"${stat.size}-${stat.mtimeMs}"`;

    if (res) {
      res.setHeader('Cache-Control', 'private, no-cache');
      res.setHeader('ETag', etag);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');

      // Conditional revalidation
      if (req?.headers?.['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }
    }

    // 6. Video streaming vs Image delivery
    const lowerFilename = filename.toLowerCase();
    if (
      lowerFilename.endsWith('.mp4') ||
      lowerFilename.endsWith('.webm')
    ) {
      if (res && req) {
        this.mediaStreamingService.streamVideo(filePath, req, res, isHeadRequest);
      }
      return;
    }

    let mimeType = 'application/octet-stream';
    if (lowerFilename.endsWith('.webp')) mimeType = 'image/webp';
    else if (lowerFilename.endsWith('.jpg') || lowerFilename.endsWith('.jpeg'))
      mimeType = 'image/jpeg';
    else if (lowerFilename.endsWith('.png')) mimeType = 'image/png';

    if (res) {
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

  /**
   * Serves user avatar image assets enforcing filename sanitization,
   * database avatar linkage, mutual user block invariants, and ETag revalidation.
   */
  async getAvatarMedia(
    userId: number,
    filename: string,
    currentUser?: ActiveUserData,
    req?: Request,
    res?: Response,
    isHeadRequest = false,
  ): Promise<void> {
    // 1. Strict filename sanitization (avatars are images only)
    const validAvatarFileRegex = /^[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/i;
    if (!filename || !validAvatarFileRegex.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }

    // 2. Database user & avatar linkage check
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatar_url: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      !user.avatar_url ||
      (!user.avatar_url.endsWith('/' + filename) &&
        !user.avatar_url.endsWith(filename))
    ) {
      throw new NotFoundException('Avatar not found');
    }

    // 3. Mutual user block check (guests are allowed; authenticated users checked)
    const currentUserId = currentUser?.id;
    if (currentUserId && currentUserId !== userId) {
      const block = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blocker_id: currentUserId, blocked_id: userId },
            { blocker_id: userId, blocked_id: currentUserId },
          ],
        },
      });
      if (block) {
        throw new NotFoundException('User not found');
      }
    }

    // 4. Physical file verification
    const filePath = join(AVATAR_UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    const stat = fs.statSync(filePath);
    const etag = `W/"${stat.size}-${stat.mtimeMs}"`;

    if (res) {
      res.setHeader('Cache-Control', 'private, no-cache');
      res.setHeader('ETag', etag);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');

      // Conditional revalidation
      if (req?.headers?.['if-none-match'] === etag) {
        res.status(304).end();
        return;
      }
    }

    const lowerFilename = filename.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (lowerFilename.endsWith('.webp')) mimeType = 'image/webp';
    else if (lowerFilename.endsWith('.jpg') || lowerFilename.endsWith('.jpeg'))
      mimeType = 'image/jpeg';
    else if (lowerFilename.endsWith('.png')) mimeType = 'image/png';

    if (res) {
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
}
