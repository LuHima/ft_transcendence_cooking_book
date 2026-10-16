import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import {
  CatalogMetadataResponseDto,
  IngredientResponseDto,
  TagResponseDto,
} from './dto/catalog-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiInternalServerErrorResponseDto,
} from 'src/common/dto/api-error-response.dto';
import { LocaleQueryDto } from 'src/common/dto/locale-query.dto';
import { FilterIngredientDto } from './dto/filter-ingredient.dto';

/**
 * Controller providing access to system metadata dictionaries, curated tags, and ingredient catalogs.
 */
@ApiTags('Catalog')
@ApiInternalServerErrorResponse({
  type: ApiInternalServerErrorResponseDto,
  description: 'Internal server error',
})
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * Retrieve all static system enumerations in a single payload.
   */
  @ApiOperation({
    summary: 'Get system enumeration metadata',
    description:
      'Provides clients with all static enum dictionaries (courses, difficulties, units of measure, ingredient categories) in a single request.',
  })
  @ApiOkResponse({
    description: 'System metadata enumeration dictionary',
    type: CatalogMetadataResponseDto,
  })
  @Get('recipes/metadata')
  getMetadata() {
    return this.catalogService.getMetadata();
  }

  /**
   * Retrieve curated dietary and culinary tags.
   */
  @ApiOperation({
    summary: 'List curated tags',
    description:
      'Returns all curated tags (e.g. vegetarian, gluten-free), ordered alphabetically by localized name. Falls back to English if requested locale is missing.',
  })
  @ApiOkResponse({
    description: 'Alphabetically ordered list of localized tags',
    type: [TagResponseDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid language parameter (must be one of: it, en, fr)',
    type: ApiBadRequestResponseDto,
  })
  @Get('tags')
  async getTags(@Query() localeDto: LocaleQueryDto) {
    return await this.catalogService.getTags({ lang: localeDto?.lang });
  }

  /**
   * Retrieve curated ingredient catalog items with optional filtering and search.
   */
  @ApiOperation({
    summary: 'List and search curated ingredients',
    description:
      'Returns curated catalog ingredients matching the given category or text query, ordered alphabetically by localized name.',
  })
  @ApiOkResponse({
    description: 'Alphabetically ordered list of matching curated ingredients',
    type: [IngredientResponseDto],
  })
  @ApiBadRequestResponse({
    description: 'Invalid category or language parameter',
    type: ApiBadRequestResponseDto,
  })
  @Get('ingredients')
  async getIngredients(@Query() filterDto: FilterIngredientDto) {
    return await this.catalogService.getIngredients(filterDto);
  }
}
