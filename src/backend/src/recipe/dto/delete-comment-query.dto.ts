import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Query parameters for recipe comment deletion and deactivation.
 */
export class DeleteCommentQueryDto {
  /**
   * Permanent hard deletion flag. Restricted strictly to platform administrators.
   * When false (default), performs safe soft-deactivation (is_active = false).
   */
  @ApiPropertyOptional({
    description:
      'Permanent hard deletion flag. Restricted strictly to platform administrators. Defaults to false (soft deactivation).',
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hard?: boolean = false;

  /**
   * Explicit cascade confirmation flag when hard-deleting a parent comment that has child replies.
   * If replies exist and this flag is not true, returns 409 Conflict.
   */
  @ApiPropertyOptional({
    description:
      'Explicit confirmation flag required when permanently hard-deleting a comment that has child replies. When true, cascades permanent deletion to all child replies.',
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  prune_replies?: boolean = false;
}
