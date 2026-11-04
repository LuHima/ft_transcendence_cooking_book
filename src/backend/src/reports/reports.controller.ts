import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiParam,
} from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Auth } from '../common/decorators/policies.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { ActiveUserData } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import {
  ReportItemDto,
  PaginatedReportsResponseDto,
} from './dto/report-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiForbiddenResponseDto,
  ApiNotFoundResponseDto,
  ApiConflictResponseDto,
  ApiInternalServerErrorResponseDto,
} from '../common/dto/api-error-response.dto';

@ApiTags('Reports')
@ApiInternalServerErrorResponse({
  type: ApiInternalServerErrorResponseDto,
  description: 'Internal server error',
})
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Submit a content violation report.
   */
  @ApiOperation({
    summary: 'Submit content report',
    description:
      'Reports an offensive recipe, comment, or user profile for moderation review.',
  })
  @ApiCreatedResponse({
    description: 'Report successfully submitted',
    type: ReportItemDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or validation failed',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Target item not found',
    type: ApiNotFoundResponseDto,
  })
  @ApiConflictResponse({
    description: 'A pending report already exists for this item',
    type: ApiConflictResponseDto,
  })
  @Auth()
  @Post()
  async createReport(
    @CurrentUser('id') reporterId: number,
    @Body() dto: CreateReportDto,
  ): Promise<ReportItemDto> {
    return await this.reportsService.createReport(reporterId, dto);
  }

  /**
   * List content reports moderation queue (Admin/Moderator only).
   */
  @ApiOperation({
    summary: 'List reports queue (Admin/Moderator only)',
    description:
      'Retrieves a paginated list of content reports with optional filtering by status and subject.',
  })
  @ApiOkResponse({
    description: 'Paginated moderation queue',
    type: PaginatedReportsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid query parameters',
    type: ApiBadRequestResponseDto,
  })
  @Auth()
  @Roles('admin', 'moderator')
  @Get()
  async getReports(
    @Query() query: ReportQueryDto,
  ): Promise<PaginatedReportsResponseDto> {
    return await this.reportsService.getReports(query);
  }

  /**
   * Update report status and record moderation resolution notes (Admin/Moderator only).
   */
  @ApiOperation({
    summary: 'Resolve report (Admin/Moderator only)',
    description:
      'Updates status and optional resolution notes of a content report.',
  })
  @ApiParam({
    name: 'id',
    description: 'Numeric report identifier',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Report successfully updated',
    type: ReportItemDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input or ID format',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden: Moderator cannot resolve report against administrator content with takedown/ban',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Report not found',
    type: ApiNotFoundResponseDto,
  })
  @Auth()
  @Roles('admin', 'moderator')
  @Patch(':id')
  async updateReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportDto,
    @CurrentUser() caller?: ActiveUserData,
  ): Promise<ReportItemDto> {
    return await this.reportsService.updateReport(id, dto, caller);
  }
}
