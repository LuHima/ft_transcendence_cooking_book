import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CatalogService } from '../catalog/catalog.service';
import {
  IngredientDetailResponseDto,
  TagDetailResponseDto,
} from '../catalog/dto/catalog-response.dto';
import { CreateIngredientDto } from '../catalog/dto/create-ingredient.dto';
import { UpdateIngredientDto } from '../catalog/dto/update-ingredient.dto';
import { CreateTagDto } from '../catalog/dto/create-tag.dto';
import { UpdateTagDto } from '../catalog/dto/update-tag.dto';
import { Auth } from '../common/decorators/policies.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import {
  ApiBadRequestResponseDto,
  ApiConflictResponseDto,
  ApiForbiddenResponseDto,
  ApiNotFoundResponseDto,
} from '../common/dto/api-error-response.dto';

/**
 * Controller providing administrative management of curated ingredients and tags.
 * Restricted strictly to administrators.
 */
@ApiTags('Administrative Catalog Management')
@ApiBearerAuth('JWT')
@Auth()
@Roles('admin')
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  /**
   * Retrieve a single curated ingredient by ID with all its translations (admin inspection).
   */
  @ApiOperation({
    summary: 'Get curated ingredient detail by ID (admin)',
    description:
      'Returns a single curated catalog ingredient by its numeric ID with complete translation maps across all supported locales (Italian, English, French). Restricted to administrators.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique numeric ingredient ID',
    example: 12,
  })
  @ApiOkResponse({
    description: 'Single curated ingredient details with full translation map',
    type: IngredientDetailResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can inspect administrative catalog details',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ingredient not found',
    type: ApiNotFoundResponseDto,
  })
  @Get('ingredients/:id')
  async getIngredientById(@Param('id', ParseIntPipe) id: number) {
    return await this.catalogService.getIngredientDetail(id);
  }

  /**
   * Retrieve a single curated tag by ID with all its translations (admin inspection).
   */
  @ApiOperation({
    summary: 'Get curated tag detail by ID (admin)',
    description:
      'Returns a single curated catalog tag by its numeric ID with complete translation maps across all supported locales (Italian, English, French). Restricted to administrators.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique numeric tag ID',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Single curated tag details with full translation map',
    type: TagDetailResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can inspect administrative catalog details',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Tag not found',
    type: ApiNotFoundResponseDto,
  })
  @Get('tags/:id')
  async getTagById(@Param('id', ParseIntPipe) id: number) {
    return await this.catalogService.getTagDetail(id);
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
  @Post('ingredients')
  async createIngredient(
    @CurrentUser() user: ActiveUserData,
    @Body() dto: CreateIngredientDto,
  ) {
    return await this.catalogService.createIngredient(user, dto);
  }

  /**
   * Update the translations of an existing ingredient (admin only).
   */
  @ApiOperation({
    summary: 'Update a curated ingredient',
    description:
      'Updates the Italian, English and French names of an existing ingredient. The slug and category are immutable. Restricted to administrators.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique numeric ingredient ID',
    example: 12,
  })
  @ApiOkResponse({
    description: 'Ingredient updated with all its translations',
    type: IngredientDetailResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid translations',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Only administrators can update catalog ingredients',
    type: ApiForbiddenResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Ingredient not found',
    type: ApiNotFoundResponseDto,
  })
  @Patch('ingredients/:id')
  async updateIngredient(
    @CurrentUser() user: ActiveUserData,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIngredientDto,
  ) {
    return await this.catalogService.updateIngredient(user, id, dto);
  }

  /**
   * Delete a curated ingredient (admin only). Refused if the ingredient is used by any recipe.
   */
  @ApiOperation({
    summary: 'Delete a curated ingredient',
    description:
      'Deletes an ingredient from the catalog. Returns 409 if the ingredient is used by one or more recipes. Restricted to administrators.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique numeric ingredient ID',
    example: 12,
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
    type: ApiNotFoundResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Ingredient is used by one or more recipes and cannot be deleted',
    type: ApiConflictResponseDto,
  })
  @Delete('ingredients/:id')
  async deleteIngredient(
    @CurrentUser() user: ActiveUserData,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.catalogService.deleteIngredient(user, id);
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
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique numeric tag ID',
    example: 1,
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
    type: ApiNotFoundResponseDto,
  })
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
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Unique numeric tag ID',
    example: 1,
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
    type: ApiNotFoundResponseDto,
  })
  @ApiConflictResponse({
    description: 'Tag is used by one or more recipes and cannot be deleted',
    type: ApiConflictResponseDto,
  })
  @Delete('tags/:id')
  async deleteTag(
    @CurrentUser() user: ActiveUserData,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.catalogService.deleteTag(user, id);
  }
}
