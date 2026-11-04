import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Auth } from '../common/decorators/policies.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminCommentQueryDto } from './dto/admin-comment-query.dto';
import { PaginatedAdminCommentsResponseDto } from './dto/admin-comment-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiForbiddenResponseDto,
} from '../common/dto/api-error-response.dto';

/**
 * Controller providing administrative and moderation comment audit endpoints.
 * Authorized for admin and moderator roles.
 */
@ApiTags('Admin Comments')
@ApiBearerAuth('JWT')
@Auth()
@Roles('admin', 'moderator')
@Controller('admin/comments')
export class AdminCommentsController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * Audit stream for platform recipe comments.
   */
  @ApiOperation({
    summary: 'Comment audit stream (Admin and Moderator)',
    description:
      'Provides an administrative comment audit feed supporting multi-dimensional sorting (newest, oldest, recipe, reports_desc), status filtering (active, inactive, all), modified comments triage (is_edited), search, and dual presentation formats (flat stream or threaded view with windowed replies).',
  })
  @ApiOkResponse({
    description: 'Paginated comment audit records',
    type: PaginatedAdminCommentsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed on query parameters',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden: Insufficient privileges (requires admin or moderator role)',
    type: ApiForbiddenResponseDto,
  })
  @Get()
  async findAllAdminComments(
    @Query() query: AdminCommentQueryDto,
  ): Promise<PaginatedAdminCommentsResponseDto> {
    return await this.adminService.findAllAdminComments(query);
  }
}
