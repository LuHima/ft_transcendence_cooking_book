import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

/**
 * Query parameters for listing confirmed friends with pagination and username search.
 */
export class FriendQueryDto extends PaginationQueryDto {
  /**
   * Optional case-insensitive substring filter for friend username.
   * @example 'giulia'
   */
  @ApiPropertyOptional({
    description: 'Case-insensitive username substring filter',
    example: 'giulia',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
