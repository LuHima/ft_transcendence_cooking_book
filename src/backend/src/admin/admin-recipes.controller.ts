import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RecipeService } from '../recipe/recipe.service';
import { Auth } from '../common/decorators/policies.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CurrentUser,
  type ActiveUserData,
} from '../common/decorators/current-user.decorator';
import { AdminRecipeQueryDto } from './dto/admin-recipe-query.dto';
import { PaginatedRecipeResponseDto } from '../recipe/dto/recipe-response.dto';
import {
  ApiBadRequestResponseDto,
  ApiForbiddenResponseDto,
} from '../common/dto/api-error-response.dto';

/**
 * Controller providing administrative recipe search and triage stream.
 * Authorized for administrator and moderator roles.
 */
@ApiTags('Admin Recipes')
@ApiBearerAuth('JWT')
@Auth()
@Roles('admin', 'moderator')
@Controller('admin/recipes')
export class AdminRecipesController {
  constructor(private readonly recipeService: RecipeService) {}

  /**
   * Search and list platform recipes across all lifecycle statuses and role-scoped privacy tiers.
   */
  @ApiOperation({
    summary: 'Administrative recipe stream (Admin and Moderator)',
    description:
      'Provides a dedicated administrative recipe stream supporting status filtering (active, inactive, all) and search capabilities, enforcing platform privacy visibility boundaries (Admins access all privacy tiers; Moderators access public and friends-only recipes, plus private recipes only if actively reported).',
  })
  @ApiOkResponse({
    description: 'Paginated recipe records conforming to platform visibility matrix',
    type: PaginatedRecipeResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation failed on query parameters',
    type: ApiBadRequestResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Forbidden: Insufficient privileges (requires admin or moderator role)',
    type: ApiForbiddenResponseDto,
  })
  @Get()
  async getAdminRecipes(
    @Query() query: AdminRecipeQueryDto,
    @CurrentUser() caller: ActiveUserData,
  ): Promise<PaginatedRecipeResponseDto> {
    return await this.recipeService.getAdminRecipes(query, caller);
  }
}
