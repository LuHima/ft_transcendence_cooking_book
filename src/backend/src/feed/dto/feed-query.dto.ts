import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Query parameter data transfer object for fetching the personalized friends activity feed.
 * Supports pagination window and optional language localization code.
 */
export class FeedQueryDto extends PaginationQueryDto {
  /**
   * Target locale code for projected title and description translations.
   * Defaults to the author's compose source language if omitted.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Target locale code for projected title and description translations',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @IsOptional()
  @IsIn(['it', 'en', 'fr'], {
    message: 'lang must be one of the following values: it, en, fr',
  })
  lang?: 'it' | 'en' | 'fr';
}
