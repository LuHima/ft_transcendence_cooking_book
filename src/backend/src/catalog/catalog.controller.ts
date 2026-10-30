import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import {
  IngredientDetailResponseDto,
  IngredientResponseDto,
  TagResponseDto,
} from './dto/catalog-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiConflictResponseDto,
  ApiForbiddenResponseDto,
  ApiInternalServerErrorResponseDto,
} from 'src/common/dto/api-error-response.dto';
import { Auth } from 'src/common/decorators/policies.decorator';
import {
  type ActiveUserData,
  CurrentUser,
} from 'src/common/decorators/current-user.decorator';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
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

  /**
   * Add a new ingredient to the curated catalog (admin only).
   */
  @ApiOperation({
    summary: 'Create a curated ingredient',
    description:
      'Adds a new ingredient to the catalog with its Italian, English and French names. Restricted to administrators.',
  })
  @ApiCreatedResponse({
    description: 'Ingredient created with all its translations',
    type: IngredientDetailResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid slug, category or translations',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can create catalog ingredients',
    type: ApiForbiddenResponseDto,
  })
  @ApiConflictResponse({
    description: 'An ingredient with this slug already exists',
    type: ApiConflictResponseDto,
  })
  @Auth()
  @Post('ingredients')
  async createIngredient(
    @CurrentUser() user: ActiveUserData,
    @Body() dto: CreateIngredientDto,
  ) {
    return await this.catalogService.createIngredient(user, dto);
  }
}
