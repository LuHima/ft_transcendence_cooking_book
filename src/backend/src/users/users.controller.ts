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
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { Auth } from 'src/common/decorators/policies.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { OptionalAuthGuard } from 'src/common/guards/optional-auth.guard';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { PaginatedFriendsResponseDto } from 'src/friends/dto/friend-response.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { avatarMulterOptions } from './avatar.multer';
import {
  UserProfileResponseDto,
  PublicUserResponseDto,
  UserSearchResultDto,
  AvatarUploadResponseDto,
  UserMessageResponseDto,
  UserSearchItemDto,
  PaginatedUsersResponseDto,
} from './dto/user-profile-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiNotFoundResponseDto,
  ApiConflictResponseDto,
  ApiInternalServerErrorResponseDto,
} from 'src/common/dto/api-error-response.dto';
import { SearchUserQueryDto } from './dto/search-user-query.dto';
import { UserCookbookQueryDto } from './dto/user-cookbook-query.dto';
import { PaginatedRecipeResponseDto } from 'src/recipe/dto/recipe-response.dto';

/**
 * Controller handling user profiles, account preferences, avatar uploads, and social interactions.
 */
@ApiTags('Users')
@ApiInternalServerErrorResponse({
  type: ApiInternalServerErrorResponseDto,
  description: 'Internal server error',
})
@Controller('users')
export class UsersController {
  constructor(private readonly userService: UsersService) {}

  /**
   * Retrieve full profile details for the authenticated user.
   */
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns private personal and account details for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Current user profile information',
    type: UserProfileResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User record not found',
    type: ApiNotFoundResponseDto,
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
    description:
      'Modifies account profile fields (name, email, birthday, phone, address).',
  })
  @ApiOkResponse({
    description: 'Updated user profile information',
    type: UserProfileResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or invalid date format',
    type: ApiBadRequestResponseDto,
  })
  @ApiConflictResponse({
    description: 'Username or email is already taken by another account',
    type: ApiConflictResponseDto,
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
    description:
      'Uploads and updates the user profile photo. Replaces any existing avatar file on disk.',
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
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
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
    description:
      'Removes the avatar file from disk and nullifies the database reference.',
  })
  @ApiOkResponse({
    description: 'Avatar successfully deleted',
    type: UserMessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
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
    description:
      'Returns recipes previously liked by the current user, ordered by most recently liked.',
  })
  @ApiOkResponse({
    description: 'Paginated recipes liked by the user',
    type: PaginatedRecipeResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or language parameter',
    type: ApiBadRequestResponseDto,
  })
  @Auth()
  @Get('me/likes')
  async getLikedRecipes(
    @CurrentUser('id') id: number,
    @Query() query: UserCookbookQueryDto,
  ) {
    return await this.userService.getLikedRecipes(id, query);
  }

  /**
   * Retrieve list of recipes authored by the authenticated user.
   */
  @ApiOperation({
    summary: 'Get current user authored recipes',
    description:
      'Returns recipes authored by the authenticated user, ordered by creation date.',
  })
  @ApiOkResponse({
    description: 'Paginated recipes authored by the user',
    type: PaginatedRecipeResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or language parameter',
    type: ApiBadRequestResponseDto,
  })
  @Auth()
  @Get('me/recipes')
  async getMyRecipes(
    @CurrentUser('id') id: number,
    @Query() query: UserCookbookQueryDto,
  ) {
    return await this.userService.getMyRecipes(id, query);
  }

  /**
   * Search and discover community members.
   */
  @ApiOperation({
    summary: 'Search and discover community members',
    description:
      'Returns a paginated list of active community members.\n\n' +
      '- When search is omitted: returns active members ordered by total published recipes (recipes_count_desc).\n' +
      '- When search is provided: performs case-insensitive substring matching across username, first_name, and last_name (defaulting to username_asc).\n' +
      '- When authenticated: caller is excluded from results and receives contextual friendship_status.\n' +
      '- When unauthenticated: friendship_status is null.\n' +
      '- Inactive, disabled, banned, and soft-deleted accounts are excluded.',
  })
  @ApiOkResponse({
    description: 'Paginated user search and discovery results',
    type: PaginatedUsersResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid query parameters (search query shorter than 2 non-whitespace characters, negative page index, limit exceeding 100, or invalid sort option)',
    type: ApiBadRequestResponseDto,
  })
  @UseGuards(OptionalAuthGuard)
  @Get()
  async findUsers(
    @Query() query: SearchUserQueryDto,
    @CurrentUser('id') currentUserId?: number,
  ): Promise<PaginatedUsersResponseDto> {
    return await this.userService.findUsers(query, currentUserId);
  }

  /**
   * Retrieve safe public profile by username handle.
   */
  @ApiOperation({
    summary: 'Get public user profile by username',
    description:
      'Returns enriched public profile information (username, bio, names, avatar, join date, recipes count, friends count, total likes received) for the specified username handle, including contextual friendship status when requested by an authenticated user.',
  })
  @ApiParam({
    name: 'username',
    description: 'Target username handle',
    example: 'mario_rossi',
  })
  @ApiOkResponse({
    description: 'Public user profile',
    type: PublicUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @UseGuards(OptionalAuthGuard)
  @Get('by-username/:username')
  async getUserByUsername(
    @Param('username') username: string,
    @CurrentUser('id') currentUserId?: number,
  ) {
    return await this.userService.getUserByUsername(username, currentUserId);
  }

  /**
   * Retrieve safe public profile for a specific user ID.
   */
  @ApiOperation({
    summary: 'Get public user profile by ID',
    description:
      'Returns enriched public profile information (username, bio, names, avatar, join date, recipes count, friends count, total likes received) for the specified user ID, including contextual friendship status when requested by an authenticated user.',
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
  @ApiBadRequestResponse({
    description: 'Invalid user ID format (must be an integer)',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @UseGuards(OptionalAuthGuard)
  @Get(':id')
  async getUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId?: number,
  ) {
    return await this.userService.getUser(id, currentUserId);
  }

  /**
   * Retrieve public recipes authored by a specific user ID.
   */
  @ApiOperation({
    summary: 'Get public recipes authored by user',
    description:
      'Returns paginated public recipes authored by the specified user, ordered descending by creation date.',
  })
  @ApiParam({
    name: 'id',
    description: 'Target author user ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Paginated recipes authored by the user',
    type: PaginatedRecipeResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid user ID format or invalid pagination/language query parameters',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @UseGuards(OptionalAuthGuard)
  @Get(':id/recipes')
  async getUserPublicRecipes(
    @Param('id', ParseIntPipe) targetUserId: number,
    @Query() query: UserCookbookQueryDto,
    @CurrentUser('id') currentUserId?: number,
  ) {
    return await this.userService.getUserPublicRecipes(
      targetUserId,
      query,
      currentUserId,
    );
  }

  /**
   * Retrieve confirmed friends for a specific user.
   */
  @ApiOperation({
    summary: 'Get user confirmed friends',
    description:
      'Returns a paginated list of confirmed friends for the specified user ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'Target user ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Paginated collection of friends',
    type: PaginatedFriendsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid user ID format or invalid pagination parameter',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @Auth()
  @Get(':id/friends')
  async getUserFriends(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: PaginationQueryDto,
  ) {
    return await this.userService.getUserFriends(id, query);
  }
}
