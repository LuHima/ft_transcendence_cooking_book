import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Query parameter data transfer object for fetching user notifications.
 * Extends common PaginationQueryDto and adds unread filtering and language localization.
 */
export class NotificationQueryDto extends PaginationQueryDto {
  /**
   * Filter to retrieve only unread notifications (is_read: false).
   * @example false
   */
  @ApiPropertyOptional({
    description:
      'Filter to retrieve only unread notifications (is_read: false)',
    example: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  unread_only?: boolean;

  /**
   * Target language code for human-readable notification messages and localized recipe titles.
   * Defaults to 'en' when omitted.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Target language code for human-readable notification messages and localized recipe titles',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @IsOptional()
  @IsIn(['it', 'en', 'fr'], {
    message: 'lang must be one of the following values: it, en, fr',
  })
  lang?: 'it' | 'en' | 'fr';
}
