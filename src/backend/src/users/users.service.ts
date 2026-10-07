import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { resolveStoredUploadPath } from '../common/config/upload-paths';
import * as fs from 'fs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    return user;
  }

  async getUserByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: username,
      },
    });
    return user;
  }

  async getUserById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    return user;
  }

  async findUser(username: string) {
    const user = await this.prisma.user.findMany({
      where: {
        username: {
          contains: username,
          mode: 'insensitive',
        },
      },
      select: {
        username: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getUser(id: number) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getMe(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatar_url: true,
        first_name: true,
        last_name: true,
        birth_date: true,
        phone: true,
        address: true,
        city: true,
        postal_code: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMe(id: number, updateUserDto: UpdateUserDto) {
    const data: Prisma.UserUpdateInput = { ...updateUserDto };
    if (updateUserDto.email !== undefined && updateUserDto.email !== null) {
      data.email = updateUserDto.email.trim().toLowerCase();
    }
    if (updateUserDto.birth_date !== undefined) {
      if (
        updateUserDto.birth_date === '' ||
        updateUserDto.birth_date === null
      ) {
        data.birth_date = null;
      } else {
        const parsedDate = new Date(updateUserDto.birth_date);
        if (isNaN(parsedDate.getTime())) {
          throw new BadRequestException('Invalid birth_date format');
        }
        data.birth_date = parsedDate;
      }
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatar_url: true,
          first_name: true,
          last_name: true,
          birth_date: true,
          phone: true,
          address: true,
          city: true,
          postal_code: true,
          created_at: true,
        },
      });
      return updatedUser;
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Username or email already in use');
      }
      throw new NotFoundException('User not found');
    }
  }

  // ---------------------------------------------------------------------------

  private async safeUnlink(fileUrl: string | null | undefined): Promise<void> {
    if (!fileUrl) return;
    const localPath = resolveStoredUploadPath(fileUrl);
    if (!localPath) return;
    try {
      await fs.promises.unlink(localPath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        // Silently ignore non-critical unlinking errors
      }
    }
  }

  // ---------------------------------------------------------------------------

  async updateAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    // Verify that the target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatar_url: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Delete previously uploaded avatar file from disk if present
    await this.safeUnlink(user.avatar_url);

    const avatarUrl = `/uploads/avatars/${file.filename || file.originalname}`;

    // Persist the new avatar path
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar_url: avatarUrl },
    });

    return { avatar_url: avatarUrl };
  }

  // ---------------------------------------------------------------------------

  async deleteAvatar(userId: number): Promise<{ message: string }> {
    // Verify that the target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatar_url: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Remove the existing avatar file from disk if present
    await this.safeUnlink(user.avatar_url);

    // Set the avatar URL in database to null
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatar_url: null },
    });

    return { message: 'Avatar deleted successfully' };
  }

  // ---------------------------------------------------------------------------

  async getLikedRecipes(userId: number, lang?: string) {
    // Retrieve all recipes liked by the user, ordered by most recently liked
    const likes = await this.prisma.like.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        recipe: {
          include: {
            translations: true,
            user: {
              select: {
                id: true,
                username: true,
                avatar_url: true,
              },
            },
          },
        },
      },
    });

    const recipes = likes.map((item) => item.recipe);

    // If no language is specified, return raw recipe entities with all translations
    if (!lang) {
      return recipes;
    }

    // When a language is provided, project localized title and description
    return recipes.map((recipe) => {
      const targetLocale =
        lang === 'it' || lang === 'en' || lang === 'fr'
          ? lang
          : recipe.source_lang;

      const translation =
        recipe.translations.find((t) => t.locale === targetLocale) ??
        recipe.translations.find((t) => t.locale === recipe.source_lang) ??
        recipe.translations[0];

      return {
        ...recipe,
        title: translation?.title ?? null,
        description: translation?.description ?? null,
      };
    });
  }
}
