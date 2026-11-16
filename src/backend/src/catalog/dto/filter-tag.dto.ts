import { ApiPropertyOptional } from '@nestjs/swagger';
import { CatalogQueryDto } from './catalog-query.dto';
import { MAX_SEARCH_LENGTH } from '../../common/validators/validation-constants';

/**
 * Query parameter data transfer object for filtering, searching, sorting, and paginating the tag catalog.
 */
export class FilterTagDto extends CatalogQueryDto {
  /**
   * Case-insensitive substring search across tag slugs and translations.
   * @example 'vegan'
   */
  @ApiPropertyOptional({
    description:
      'Case-insensitive substring search across tag slugs and translations (max 100 characters)',
    maxLength: MAX_SEARCH_LENGTH,
    example: 'vegan',
  })
  override search?: string = undefined;
}
