import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

/**
 * Query parameters for pending friend requests.
 */
export class FriendRequestQueryDto extends PaginationQueryDto {
  /**
   * Filter request type: incoming (received) or outgoing (sent).
   * @example 'incoming'
   */
  @ApiPropertyOptional({
    description: 'Filter requests: incoming (received) or outgoing (sent)',
    enum: ['incoming', 'outgoing'],
    default: 'incoming',
    example: 'incoming',
  })
  @IsOptional()
  @IsIn(['incoming', 'outgoing'])
  type?: 'incoming' | 'outgoing' = 'incoming';
}
