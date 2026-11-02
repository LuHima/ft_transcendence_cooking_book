import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ReportStatus, ReportSubject } from '@prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

/**
 * Query filters for the administrative moderation reports queue.
 */
export class ReportQueryDto extends PaginationQueryDto {
  /**
   * Filter reports by current review status.
   * @example 'pending'
   */
  @ApiPropertyOptional({
    enum: ReportStatus,
    enumName: 'ReportStatus',
    description: 'Filter reports by current review status',
    example: ReportStatus.pending,
  })
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  /**
   * Filter reports by target subject entity type.
   * @example 'recipe'
   */
  @ApiPropertyOptional({
    enum: ReportSubject,
    enumName: 'ReportSubject',
    description: 'Filter reports by target entity type',
    example: ReportSubject.recipe,
  })
  @IsOptional()
  @IsEnum(ReportSubject)
  subject?: ReportSubject;
}
