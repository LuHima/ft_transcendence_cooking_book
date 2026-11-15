import { ApiProperty } from '@nestjs/swagger';

/**
 * Compact staff user summary for moderation and sanction audit trails.
 */
export class StaffActorSummaryDto {
  @ApiProperty({ description: 'Numeric user ID of the staff actor', example: 1 })
  id: number;

  @ApiProperty({
    description: 'Username of the staff actor',
    example: 'mod_alice',
  })
  username: string;

  @ApiProperty({
    description: 'Avatar image URL of the staff actor',
    example: '/uploads/avatars/avatar_1.webp',
    nullable: true,
    type: String,
  })
  avatar_url: string | null;
}
