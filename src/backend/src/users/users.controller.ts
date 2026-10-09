import {
  Param,
  ParseIntPipe,
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Query,
  UseFilters,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { HttpExceptionFilter } from 'src/common/filters/http.exeption.filter';
import { Auth } from 'src/common/decorators/policies.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { avatarMulterOptions } from './avatar.multer';
import {
  UserProfileResponseDto,
  PublicUserResponseDto,
  UserSearchResultDto,
  AvatarUploadResponseDto,
  UserMessageResponseDto,
} from './dto/user-profile-response.dto';
import { ApiErrorResponseDto } from 'src/common/dto/api-error-response.dto';

/**
 * Controller handling user profiles, account preferences, avatar uploads, and social interactions.
 */
@ApiTags('Users')
@Controller('users')
@UseFilters(HttpExceptionFilter)
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  /**
   * Retrieve full profile details for the authenticated user.
   */
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns private personal and account details for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Current user profile information',
    type: UserProfileResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User record not found',
    type: ApiErrorResponseDto,
  })
  @Auth()
  @Get('me')
  async getMe(@CurrentUser('id') id: number) {
    return await this.userService.getMe(id);
  }

  /**
   * Update profile information for the authenticated user.
   */
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Modifies account profile fields (name, email, birthday, phone, address).',
  })
  @ApiOkResponse({
    description: 'Updated user profile information',
    type: UserProfileResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or invalid date format',
    type: ApiErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Username or email is already taken by another account',
    type: ApiErrorResponseDto,
  })
  @Auth()
  @Patch('me')
  async updateMe(
    @CurrentUser('id') id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.updateMe(id, updateUserDto);
  }

  /**
   * Upload and update avatar photo for the authenticated user.
   */
  @ApiOperation({
    summary: 'Upload user avatar',
    description: 'Uploads and updates the user profile photo. Replaces any existing avatar file on disk.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file (JPEG, PNG, or WebP; maximum 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Avatar successfully uploaded',
    type: AvatarUploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'File missing or invalid file format',
    type: ApiErrorResponseDto,
  })
  @Auth()
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', avatarMulterOptions))
  async updateAvatar(
    @CurrentUser('id') id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return await this.userService.updateAvatar(id, file);
  }

  /**
   * Delete avatar photo for the authenticated user.
   */
  @ApiOperation({
    summary: 'Delete user avatar',
    description: 'Removes the avatar file from disk and nullifies the database reference.',
  })
  @ApiOkResponse({
    description: 'Avatar successfully deleted',
    type: UserMessageResponseDto,
  })
  @Auth()
  @Delete('me/avatar')
  async deleteAvatar(@CurrentUser('id') id: number) {
    return await this.userService.deleteAvatar(id);
  }

  /**
   * Retrieve list of recipes liked by the authenticated user.
   */
  @ApiOperation({
    summary: 'Get liked recipes',
    description: 'Returns recipes previously liked by the current user, ordered by most recently liked.',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Target language for projected recipe titles and descriptions',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @ApiOkResponse({
    description: 'List of recipes liked by the user',
  })
  @Auth()
  @Get('me/likes')
  async getLikedRecipes(
    @CurrentUser('id') id: number,
    @Query('lang') lang?: string,
  ) {
    return await this.userService.getLikedRecipes(id, lang);
  }

  /**
   * Search users by username substring.
   */
  @ApiOperation({
    summary: 'Search users by username',
    description: 'Searches users by username substring matching (case-insensitive).',
  })
  @ApiQuery({
    name: 'value',
    required: true,
    description: 'Username substring search query',
    example: 'mario',
  })
  @ApiOkResponse({
    description: 'List of matching usernames',
    type: [UserSearchResultDto],
  })
  @Get('search')
  async searchUser(@Query('value') username: string) {
    return await this.userService.findUser(username);
  }

  /**
   * Retrieve safe public profile for a specific user ID.
   */
  @ApiOperation({
    summary: 'Get public user profile by ID',
    description: 'Returns public profile information (username, avatar, join date) for the specified user.',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric user ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Public user profile',
    type: PublicUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiErrorResponseDto,
  })
  @Get(':id')
  async getUser(@Param('id', ParseIntPipe) id: number) {
    return await this.userService.getUser(id);
  }
}
