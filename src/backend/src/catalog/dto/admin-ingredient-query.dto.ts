import { ApiPropertyOptional } from '@nestjs/swagger';
import { IngredientCategory } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

/**
 * Query parameters for administrative paginated ingredient listing.
 */
export class AdminIngredientQueryDto extends PaginationQueryDto {
  /**
   * Filter ingredients by culinary category.
   * @example IngredientCategory.dairy_eggs
   */
  @ApiPropertyOptional({
    description: 'Filter ingredients by culinary category',
    enum: IngredientCategory,
    example: IngredientCategory.dairy_eggs,
  })
  @IsOptional()
  @IsEnum(IngredientCategory)
  category?: IngredientCategory;

  /**
   * Case-insensitive substring search across ingredient slugs and translations (it, en, fr).
   * @example 'pomodoro'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search across ingredient slugs and translations (it, en, fr)',
    example: 'pomodoro',
  })
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Field to sort results by.
   * @example 'id'
   */
  @ApiPropertyOptional({
    description: 'Field to sort results by',
    enum: ['id', 'slug'],
    default: 'id',
    example: 'id',
  })
  @IsOptional()
  @IsIn(['id', 'slug'])
  sort_by?: 'id' | 'slug' = 'id';

  /**
   * Sort direction (asc or desc).
   * @example SortOrder.asc
   */
  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    default: SortOrder.asc,
    example: SortOrder.asc,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.asc;
}
