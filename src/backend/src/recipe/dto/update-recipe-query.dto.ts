import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { transformOptionalBoolean } from '../../common/dto/query-transforms';

/**
 * Query parameters for updating an existing recipe.
 */
export class UpdateRecipeQueryDto {
  /**
   * Set to true to regenerate automated translations for modified text.
   * @example true
   */
  @ApiPropertyOptional({
    description:
      'Set to true to re-generate automated translations for updated text',
    default: false,
    example: true,
  })
  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean({ message: 'retranslate must be a boolean (true or false)' })
  retranslate?: boolean = false;
}
