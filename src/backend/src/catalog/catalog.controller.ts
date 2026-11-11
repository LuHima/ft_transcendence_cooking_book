import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import {
  IngredientResponseDto,
  TagResponseDto,
} from './dto/catalog-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiInternalServerErrorResponseDto,
  ApiNotFoundResponseDto,
} from 'src/common/dto/api-error-response.dto';
import { LocaleQueryDto } from 'src/common/dto/locale-query.dto';
import { FilterIngredientDto } from './dto/filter-ingredient.dto';

/**
 * Controller providing public localized access to curated tags and ingredient catalogs.
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
   * Retrieve a single curated tag by ID localized to the requested language.
   */
  @ApiOperation({
    summary: 'Get curated tag by ID',
    description:
      'Returns a single curated catalog tag by its numeric ID, localized to the requested language (defaults to English if missing or unsupported). Public read access.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique numeric tag ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Single localized tag details',
    type: TagResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid language parameter (must be one of: it, en, fr)',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
    type: ApiNotFoundResponseDto,
  })
  @Get('tags/:id')
  async getTagById(
    @Param('id', ParseIntPipe) id: number,
    @Query() localeDto: LocaleQueryDto,
  ) {
    return await this.catalogService.getTagById(id, { lang: localeDto?.lang });
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

  /**
   * Retrieve a single curated ingredient by ID localized to the requested language.
   */
  @ApiOperation({
    summary: 'Get curated ingredient by ID',
    description:
      'Returns a single curated catalog ingredient by its numeric ID, localized to the requested language (defaults to English if missing or unsupported). Public read access.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique numeric ingredient ID',
    example: 12,
  })
  @ApiOkResponse({
    description: 'Single localized ingredient details',
    type: IngredientResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid category or language parameter',
    type: ApiBadRequestResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ingredient not found',
    type: ApiNotFoundResponseDto,
  })
  @Get('ingredients/:id')
  async getIngredientById(
    @Param('id', ParseIntPipe) id: number,
    @Query() localeDto: LocaleQueryDto,
  ) {
    return await this.catalogService.getIngredientById(id, {
      lang: localeDto?.lang,
    });
  }
}
