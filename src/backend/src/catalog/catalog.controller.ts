import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { IngredientCategory } from '@prisma/client';
import {
  CatalogMetadataResponseDto,
  IngredientResponseDto,
  TagResponseDto,
} from './dto/catalog-response.dto';

/**
 * Controller providing access to system metadata dictionaries, curated tags, and ingredient catalogs.
 */
@ApiTags('Catalog')
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
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Target locale for tag translations (default: en)',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @ApiOkResponse({
    description: 'Alphabetically ordered list of localized tags',
    type: [TagResponseDto],
  })
  @Get('tags')
  async getTags(@Query('lang') lang?: string) {
    return await this.catalogService.getTags({ lang });
  }

  /**
   * Retrieve curated ingredient catalog items with optional filtering and search.
   */
  @ApiOperation({
    summary: 'List and search curated ingredients',
    description:
      'Returns curated catalog ingredients matching the given category or text query, ordered alphabetically by localized name.',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Target locale for ingredient names (default: en)',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter ingredients by culinary category',
    enum: IngredientCategory,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description:
      'Case-insensitive substring search across ingredient slugs and translations',
    example: 'pomodoro',
  })
  @ApiOkResponse({
    description: 'Alphabetically ordered list of matching curated ingredients',
    type: [IngredientResponseDto],
  })
  @Get('ingredients')
  async getIngredients(
    @Query('lang') lang?: string,
    @Query('category') category?: IngredientCategory,
    @Query('search') search?: string,
  ) {
    return await this.catalogService.getIngredients({ lang, category, search });
  }
}
