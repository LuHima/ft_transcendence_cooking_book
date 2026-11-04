import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/**
 * Query parameters for recipe deletion and deactivation.
 */
export class DeleteRecipeQueryDto {
  /**
   * Permanent hard deletion flag. Restricted strictly to platform administrators.
   * When false (default), performs safe soft-suspension (is_active = false).
   */
  @ApiPropertyOptional({
    description:
      'Permanent hard deletion flag. Restricted strictly to platform administrators. Defaults to false (soft suspension).',
    default: false,
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hard?: boolean = false;
}
