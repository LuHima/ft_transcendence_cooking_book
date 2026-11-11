import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { ReportStatus, ReportSubject } from '@prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import type { SupportedLocale } from 'src/common/dto/locale-query.dto';

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

  /**
   * Preferred language locale for recipe label localization.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description: 'Preferred language locale for recipe label localization',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @IsOptional()
  @IsString()
  @IsIn(['it', 'en', 'fr'], {
    message: 'lang must be one of the following values: it, en, fr',
  })
  lang?: SupportedLocale;
}
