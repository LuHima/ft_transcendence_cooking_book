import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Query parameter DTO for searching users by username substring.
 */
export class SearchUserQueryDto {
  /**
   * Username substring search query.
   * @example 'mario'
   */
  @ApiProperty({
    description: 'Username substring search query',
    example: 'mario',
  })
  @IsNotEmpty({ message: 'search query parameter is required' })
  @IsString()
  search: string;
}
