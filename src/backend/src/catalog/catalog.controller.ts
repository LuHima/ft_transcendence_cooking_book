import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiCreatedResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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

import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagDetailResponseDto } from './dto/catalog-response.dto';

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

  /**
   * Add a new tag to the curated catalog (admin only).
   */
  @ApiOperation({
    summary: 'Create a curated tag',
    description:
      'Adds a new tag to the catalog with its Italian, English and French names. Restricted to administrators.',
  })
  @ApiCreatedResponse({
    description: 'Tag created with all its translations',
    type: TagDetailResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid slug or translations',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can create catalog tags',
    type: ApiForbiddenResponseDto,
  })
  @ApiConflictResponse({
    description: 'A tag with this slug already exists',
    type: ApiConflictResponseDto,
  })
  @Auth()
  @Post('tags')
  async createTag(
    @CurrentUser() user: ActiveUserData,
    @Body() dto: CreateTagDto,
  ) {
    return await this.catalogService.createTag(user, dto);
  }

  /**
   * Update the translations of an existing tag (admin only).
   */
  @ApiOperation({
    summary: 'Update a curated tag',
    description:
      'Updates the Italian, English and French names of an existing tag. The slug is immutable. Restricted to administrators.',
  })
  @ApiOkResponse({
    description: 'Tag updated with all its translations',
    type: TagDetailResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid translations',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can update catalog tags',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
  })
  @Auth()
  @Patch('tags/:id')
  async updateTag(
    @CurrentUser() user: ActiveUserData,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTagDto,
  ) {
    return await this.catalogService.updateTag(user, id, dto);
  }

    /**
   * Delete a curated tag (admin only). Refused if the tag is used by any recipe.
   */
  @ApiOperation({
    summary: 'Delete a curated tag',
    description:
      'Deletes a tag from the catalog. Returns 409 if the tag is used by one or more recipes. Restricted to administrators.',
  })
  @ApiOkResponse({
    description: 'Tag deleted successfully',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can delete catalog tags',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
  })
  @ApiConflictResponse({
    description: 'Tag is used by one or more recipes and cannot be deleted',
    type: ApiConflictResponseDto,
  })
  @Auth()
  @Delete('tags/:id')
  async deleteTag(
    @CurrentUser() user: ActiveUserData,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.catalogService.deleteTag(user, id);
  }

  /**
   * Delete a curated ingredient (admin only). Refused if the ingredient is used by any recipe.
   */
  @ApiOperation({
    summary: 'Delete a curated ingredient',
    description:
      'Deletes an ingredient from the catalog. Returns 409 if the ingredient is used by one or more recipes. Restricted to administrators.',
  })
  @ApiOkResponse({
    description: 'Ingredient deleted successfully',
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can delete catalog ingredients',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ingredient not found',
  })
  @ApiConflictResponse({
    description: 'Ingredient is used by one or more recipes and cannot be deleted',
    type: ApiConflictResponseDto,
  })
  @Auth()
  @Delete('ingredients/:id')
  async deleteIngredient(
    @CurrentUser() user: ActiveUserData,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.catalogService.deleteIngredient(user, id);
  }
}