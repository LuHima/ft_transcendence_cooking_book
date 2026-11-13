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
import {
  RecipePrivacy,
  Role,
  ReportSubject,
  ReportStatus,
  FriendshipStatus,
} from '@prisma/client';
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
   * Serves protected recipe media assets (covers, step photos, gallery, tutorial videos)
   * enforcing filename sanitization, recipe privacy tiers, mutual user blocks,
   * database asset linkage, ETag revalidation, and video streaming.
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

    // 2. Fetch recipe from database
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

    const currentUserId = currentUser?.id;
    const currentUserRole = currentUser?.role;
    const isAuthor =
      currentUserId !== undefined && currentUserId === recipe.user_id;
    const isStaff =
      currentUserRole === Role.admin || currentUserRole === Role.moderator;

    // 3. Privacy Access Control Evaluation (evaluated before linkage to prevent oracle leaks)
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
        const recipeComments = await this.prisma.comment.findMany({
          where: { recipe_id: recipe.id },
          select: { id: true },
        });
        const commentIds = recipeComments.map((c) => c.id);

        const hasActiveReport = await this.prisma.report.findFirst({
          where: {
            status: ReportStatus.pending,
            OR: [
              { subject: ReportSubject.recipe, target_id: recipe.id },
              ...(commentIds.length > 0
                ? [
                    {
                      subject: ReportSubject.comment,
                      target_id: { in: commentIds },
                    },
                  ]
                : []),
            ],
          },
        });

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
        if (recipe.user_id) {
          const friendship = await this.prisma.friendship.findFirst({
            where: {
              status: FriendshipStatus.accepted,
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

    // 4. Mutual user block invariant (staff conducting audits are immune)
    if (
      currentUserId &&
      recipe.user_id &&
      currentUserId !== recipe.user_id &&
      !isStaff
    ) {
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

    // 5. Database asset linkage check (strict prefix to avoid substring false positives)
    const expectedPrefix = '/' + filename;
    const isLinked =
      Boolean(recipe.cover_image_url?.endsWith(expectedPrefix)) ||
      Boolean(recipe.video_url?.endsWith(expectedPrefix)) ||
      recipe.steps.some((s) => s.image_url?.endsWith(expectedPrefix)) ||
      recipe.recipe_media.some((m) => m.url?.endsWith(expectedPrefix));

    if (!isLinked) {
      throw new NotFoundException('Media not found');
    }

    // 6. Physical file verification
    const filePath = join(RECIPE_UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    // 7. Video streaming vs Image delivery
    if (res && req) {
      const lowerFilename = filename.toLowerCase();
      if (lowerFilename.endsWith('.mp4') || lowerFilename.endsWith('.webm')) {
        this.mediaStreamingService.streamVideo(filePath, req, res, isHeadRequest);
      } else {
        this.mediaStreamingService.streamImage(filePath, req, res, isHeadRequest);
      }
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

    const expectedPrefix = '/' + filename;
    if (!user.avatar_url?.endsWith(expectedPrefix)) {
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

    // 5. Image delivery with ETag revalidation
    if (res && req) {
      this.mediaStreamingService.streamImage(filePath, req, res, isHeadRequest);
    }
  }
}
