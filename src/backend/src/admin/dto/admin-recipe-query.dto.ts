import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { FilterRecipeDto } from '../../recipe/dto/filter-recipe.dto';

export enum AdminRecipeStatus {
  active = 'active',
  inactive = 'inactive',
  all = 'all',
}

/**
 * Query parameters for administrative and staff recipe search stream.
 */
export class AdminRecipeQueryDto extends FilterRecipeDto {
  /**
   * Filter recipes by lifecycle status (active, inactive, all).
   * @example 'all'
   */
  @ApiPropertyOptional({
    enum: AdminRecipeStatus,
    description: 'Filter recipes by lifecycle status (active, inactive, all)',
    default: AdminRecipeStatus.all,
    example: AdminRecipeStatus.all,
  })
  @IsOptional()
  @IsEnum(AdminRecipeStatus)
  status?: AdminRecipeStatus = AdminRecipeStatus.all;
}
