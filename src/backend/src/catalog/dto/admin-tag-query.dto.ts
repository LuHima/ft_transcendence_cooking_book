import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-order.enum';

/**
 * Query parameters for administrative paginated tag listing.
 */
export class AdminTagQueryDto extends PaginationQueryDto {
  /**
   * Case-insensitive substring search across tag slugs and translations (it, en, fr).
   * @example 'vegan'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search across tag slugs and translations (it, en, fr)',
    example: 'vegan',
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
