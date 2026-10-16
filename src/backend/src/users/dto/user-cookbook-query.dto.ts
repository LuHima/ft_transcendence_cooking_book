import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Query parameter DTO for paginated user cookbook endpoints (liked recipes and authored recipes).
 */
export class UserCookbookQueryDto extends PaginationQueryDto {
  /**
   * Target localization language (it, en, fr). Defaults to author source_lang or system fallback if omitted.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Target localization language (it, en, fr). Defaults to author source_lang or system fallback if omitted.',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @IsOptional()
  @IsString()
  @IsIn(['it', 'en', 'fr'], {
    message: 'lang must be one of the following values: it, en, fr',
  })
  lang?: 'it' | 'en' | 'fr';
}
