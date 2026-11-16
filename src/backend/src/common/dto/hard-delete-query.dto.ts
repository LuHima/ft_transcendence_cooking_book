import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { transformOptionalBoolean } from './query-transforms';

/**
 * Reusable query parameter DTO for endpoints supporting soft vs permanent (?hard=true) deletion.
 */
export class HardDeleteQueryDto {
  /**
   * Permanent hard deletion flag. Restricted strictly to platform administrators.
   * When false (default), performs safe soft deactivation.
   */
  @ApiPropertyOptional({
    description:
      'Permanent hard deletion flag. Restricted strictly to platform administrators. Defaults to false (soft deactivation).',
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean({ message: 'hard must be a boolean (true or false)' })
  hard?: boolean = false;
}
