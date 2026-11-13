import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
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
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { Auth } from '../common/decorators/policies.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminSearchUserQueryDto } from './dto/admin-search-user-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import {
  AdminUserResponseDto,
  PaginatedAdminUsersResponseDto,
} from './dto/admin-user-response.dto';
import { BanHistoryItemDto } from '../reports/dto/ban-history.dto';
import { avatarMulterOptions } from '../users/avatar.multer';
import {
  ApiBadRequestResponseDto,
  ApiConflictResponseDto,
  ApiForbiddenResponseDto,
  ApiNotFoundResponseDto,
  ApiUnauthorizedResponseDto,
} from '../common/dto/api-error-response.dto';
import {
  AvatarUploadResponseDto,
  UserMessageResponseDto,
} from '../users/dto/user-profile-response.dto';

@ApiTags('Admin Users')
@ApiBearerAuth('JWT')
@Auth()
@Roles('admin')
@Controller('admin/users')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * List platform users with pagination, multi-criteria sorting, and administrative filtering.
   */
  @ApiOperation({
    summary: 'List platform users (Admin only)',
    description:
      'Returns paginated accounts matching optional role, lifecycle status, search, and sorting criteria. Includes inactive, disabled, and banned accounts.',
  })
  @ApiOkResponse({
    description: 'Paginated platform user directory',
    type: PaginatedAdminUsersResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    type: ApiBadRequestResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired authentication token',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Requires administrator privileges',
    type: ApiForbiddenResponseDto,
  })
  @Get()
  async getUsers(
    @Query() query: AdminSearchUserQueryDto,
  ): Promise<PaginatedAdminUsersResponseDto> {
    return await this.adminService.getUsers(query);
  }

  /**
   * Retrieve full chronological sanction audit trail for a user (Admin only).
   */
  @ApiOperation({
    summary: 'Get user ban history (Admin only)',
    description:
      'Returns chronological sanction audit records for repeat offender investigation.',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric user identifier',
    example: 42,
  })
  @ApiOkResponse({
    description: 'List of historical ban events',
    type: [BanHistoryItemDto],
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired authentication token',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Requires administrator privileges',
    type: ApiForbiddenResponseDto,
  })
  @Get(':id/ban-history')
  async getUserBanHistory(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BanHistoryItemDto[]> {
    return await this.adminService.getUserBanHistory(id);
  }

  /**
   * Retrieve detailed administrative user profile including repeat offender ban count (Admin only).
   */
  @ApiOperation({
    summary: 'Get user details (Admin only)',
    description:
      'Retrieves administrative view of a user profile including repeat offender ban counts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric user identifier',
    example: 42,
  })
  @ApiOkResponse({
    description: 'User details',
    type: AdminUserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired authentication token',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Requires administrator privileges',
    type: ApiForbiddenResponseDto,
  })
  @Get(':id')
  async getUser(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdminUserResponseDto> {
    return await this.adminService.getUserById(id);
  }

  /**
   * Provision a new user account with mandatory credentials and optional profile details.
   */
  @ApiOperation({
    summary: 'Provision user account (Admin only)',
    description:
      'Creates a new user account with specified credentials and role. Hashes password with bcrypt and validates optional profile and avatar attributes.',
  })
  @ApiCreatedResponse({
    description: 'User successfully provisioned',
    type: AdminUserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or invalid input format',
    type: ApiBadRequestResponseDto,
  })
  @ApiConflictResponse({
    description: 'Username or email already in use',
    type: ApiConflictResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired authentication token',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Requires administrator privileges',
    type: ApiForbiddenResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  @Post()
  async createUser(
    @Body() dto: CreateAdminUserDto,
  ): Promise<AdminUserResponseDto> {
    return await this.adminService.createUser(dto);
  }

  /**
   * Update profile details, system role, credentials, or lifecycle status for an existing user.
   */
  @ApiOperation({
    summary: 'Update user account or status (Admin only)',
    description:
      'Modifies user account attributes. Enforces anti-self-sabotage guards and last-admin protection. Selectively purges JWT sessions on credential, role, or disabling status mutations. Atomically restores platform-custody content on reactivation to active status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric user identifier',
    example: 42,
  })
  @ApiOkResponse({
    description: 'User successfully updated',
    type: AdminUserResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed or attempt to demote/disable own account (anti-self-sabotage)',
    type: ApiBadRequestResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Last administrator safeguard conflict or unique username/email collision',
    type: ApiConflictResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Target user not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired authentication token',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Requires administrator privileges',
    type: ApiForbiddenResponseDto,
  })
  @Patch(':id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser('id') currentAdminId: number,
  ): Promise<AdminUserResponseDto> {
    return await this.adminService.updateUser(id, dto, currentAdminId);
  }

  /**
   * Deactivate or permanently delete a user account.
   */
  @ApiOperation({
    summary: 'Deactivate or delete user (Admin only)',
    description:
      'By default performs soft deletion: disables account, purges active JWT sessions, transfers public recipes to platform custody, and deactivates authored comments. With ?hard=true, disassociates recipes and permanently deletes user row.',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric user identifier',
    example: 42,
  })
  @ApiQuery({
    name: 'hard',
    required: false,
    type: Boolean,
    description:
      'When true, permanently purges the user row and disassociates recipes. Defaults to false (soft deactivation).',
    example: false,
  })
  @ApiOkResponse({
    description: 'User successfully deactivated or deleted',
    type: UserMessageResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Attempt to delete own account (anti-self-sabotage)',
    type: ApiBadRequestResponseDto,
  })
  @ApiConflictResponse({
    description: 'Attempt to delete the sole remaining platform administrator',
    type: ApiConflictResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Target user not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired authentication token',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Requires administrator privileges',
    type: ApiForbiddenResponseDto,
  })
  @Delete(':id')
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentAdminId: number,
    @Query('hard') hard?: string,
  ): Promise<UserMessageResponseDto> {
    const isHard = hard === 'true' || hard === '1';
    return await this.adminService.deleteUser(id, currentAdminId, isHard);
  }

  /**
   * Upload and transcode avatar for a specific user.
   */
  @ApiOperation({
    summary: 'Upload user avatar (Admin only)',
    description:
      'Processes and transcodes uploaded image to 512x512 WebP with EXIF metadata stripped, updating the target user avatar.',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric user identifier',
    example: 42,
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
    description: 'Avatar successfully uploaded and transcoded',
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
  @ApiUnauthorizedResponse({
    description: 'Missing or expired authentication token',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Requires administrator privileges',
    type: ApiForbiddenResponseDto,
  })
  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('file', avatarMulterOptions))
  async uploadUserAvatar(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AvatarUploadResponseDto> {
    return await this.adminService.uploadUserAvatar(id, file);
  }

  /**
   * Delete avatar photo for a specific user.
   */
  @ApiOperation({
    summary: 'Delete user avatar (Admin only)',
    description:
      'Removes avatar file from disk and nullifies the database reference for the target user.',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric user identifier',
    example: 42,
  })
  @ApiOkResponse({
    description: 'Avatar successfully deleted',
    type: UserMessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired authentication token',
    type: ApiUnauthorizedResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Forbidden: Requires administrator privileges',
    type: ApiForbiddenResponseDto,
  })
  @Delete(':id/avatar')
  async deleteUserAvatar(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<UserMessageResponseDto> {
    return await this.adminService.deleteUserAvatar(id);
  }
}
