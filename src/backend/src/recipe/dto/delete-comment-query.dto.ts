import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { HardDeleteQueryDto } from '../../common/dto/hard-delete-query.dto';
import { transformOptionalBoolean } from '../../common/dto/query-transforms';

/**
 * Query parameters for recipe comment deletion and deactivation.
 */
export class DeleteCommentQueryDto extends HardDeleteQueryDto {
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
  @Transform(transformOptionalBoolean)
  @IsBoolean({ message: 'prune_replies must be a boolean (true or false)' })
  prune_replies?: boolean = false;
}
