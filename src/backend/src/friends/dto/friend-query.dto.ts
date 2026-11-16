import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';
import { trimToUndefined } from '../../common/dto/string-transforms';
import { MAX_SEARCH_LENGTH } from '../../common/validators/validation-constants';

/**
 * Query parameters for listing confirmed friends with pagination and username search.
 */
export class FriendQueryDto extends PaginationQueryDto {
  /**
   * Optional case-insensitive substring filter for friend username.
   * @example 'giulia'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive username substring filter (max 100 characters)',
    maxLength: MAX_SEARCH_LENGTH,
    example: 'giulia',
  })
  @IsOptional()
  @Transform(trimToUndefined)
  @IsString({ message: 'search query must be a text string' })
  @MaxLength(MAX_SEARCH_LENGTH, {
    message: `search query cannot exceed ${MAX_SEARCH_LENGTH} characters`,
  })
  search?: string;
}
