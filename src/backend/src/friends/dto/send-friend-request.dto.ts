import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, Min } from 'class-validator';

/**
 * Request payload for sending a friend request.
 */
export class SendFriendRequestDto {
  /**
   * Target user identifier to send friend request to.
   * @example 3
   */
  @ApiProperty({
    description: 'Target user ID to invite as friend',
    example: 3,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  recipient_id: number;
}
