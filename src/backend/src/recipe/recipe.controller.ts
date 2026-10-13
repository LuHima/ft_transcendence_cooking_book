import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  Query,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  recipeImageMulterOptions,
  recipeVideoMulterOptions,
} from './recipe-media.multer';
import { RecipeService } from './recipe.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import {
  LocalizedRecipeDetailResponse,
  RecipeMediaResponse,
} from './dto/localized-recipe.response';
import {
  RecipePaginationResponseDto,
  CoverImageUploadResponseDto,
  StepImageUploadResponseDto,
  VideoUploadResponseDto,
  RecipeLikeResponseDto,
  RecipeMessageResponseDto,
} from './dto/recipe-response.dto';
import { CatalogMetadataResponseDto } from '../catalog/dto/catalog-response.dto';
import { ApiErrorResponseDto } from 'src/common/dto/api-error-response.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { authenticate } from 'passport';
import { Auth } from 'src/common/decorators/policies.decorator';
import { Action } from 'src/auth/casl/action.enum';

/**
 * Controller handling recipe lifecycle, search, pagination, multilingual translations, media uploads, and likes.
 */
@ApiTags('Recipes')
@Controller('recipes')
export class RecipeController {
  constructor(
    private readonly recipeService: RecipeService,
    private readonly catalogService: CatalogService,
  ) {}

  // TODO @Roles(Role.admin)

  /**
   * Retrieve all recipes with optional localization.
   */
  @ApiOperation({
    summary: 'List all recipes',
    description:
      'Fetches all recipes in the system. When `lang` is specified, projects localized title and description according to preference hierarchy.',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description:
      'Target locale code for projected titles and descriptions (it, en, fr)',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @ApiOkResponse({
    description: 'Array of recipes with translations',
  })
  @Get()
  async getRecipes(@Query('lang') lang?: string) {
    return await this.recipeService.getAllRecipe(lang);
  }

  /**
   * Retrieve paginated recipe cards with cursor navigation.
   */
  @ApiOperation({
    summary: 'Get paginated recipe stack',
    description:
      'Fetches a 30-item page window of recipes optimized for infinite scrolling or stacked presentation. Includes author username and pagination indicators.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page index number (1-based, default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'value',
    required: false,
    description: 'Legacy page parameter alias',
    example: 1,
  })
  @ApiOkResponse({
    description:
      'Paginated recipe window with hasNextPage and hasPreviousPage booleans',
    type: RecipePaginationResponseDto,
  })
  @Get('page')
  async getRecipeStack(
    @Query('page') page?: number,
    @Query('value') legacyValue?: number,
  ) {
    const rawPage = page ?? legacyValue ?? 1;
    const pageNumber = Number(rawPage);
    return await this.recipeService.getRecipeStack(
      isNaN(pageNumber) || pageNumber < 1 ? 1 : pageNumber,
    );
  }

  /**
   * Retrieve static enumeration metadata dictionaries.
   */
  @ApiOperation({
    summary: 'Get recipe metadata dictionaries',
    description:
      'Convenience route returning enum dictionaries (courses, difficulties, units, categories) identical to `/api/recipes/metadata`.',
  })
  @ApiOkResponse({
    description: 'System metadata enumerations',
    type: CatalogMetadataResponseDto,
  })
  @Get('metadata')
  getMetadata() {
    return this.catalogService.getMetadata();
  }

  /**
   * Search recipes by title.
   */
  @ApiOperation({
    summary: 'Search recipes by title',
    description:
      'Performs a case-insensitive search across recipe translation titles and returns matching recipes.',
  })
  @ApiQuery({
    name: 'value',
    required: true,
    description: 'Text query to match in recipe titles',
    example: 'carbonara',
  })
  @ApiOkResponse({
    description: 'List of recipes matching the title search query',
  })
  @Get('search')
  async getRecipe(@Query('value') name: string) {
    if (!name) return [];
    return await this.recipeService.getRecipesByName(name);
  }

  /**
   * Retrieve complete localized recipe details by ID.
   */
  @ApiOperation({
    summary: 'Get recipe by ID',
    description:
      'Fetches full recipe details including localized title, description, storage tips, ordered steps with illustrations, categorized ingredients, tags, and media gallery.',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique numeric recipe ID',
    example: 42,
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    description:
      'Target localization language (it, en, fr). Defaults to author source_lang if omitted or untranslated.',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @ApiOkResponse({
    description: 'Complete localized recipe specification',
    type: LocalizedRecipeDetailResponse,
  })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Get(':id')
  async getRecipeById(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') lang?: string,
  ) {
    return await this.recipeService.getRecipeById(Number(id), lang);
  }

  /**
   * Create a new recipe with steps, ingredients, and tags.
   */
  @ApiOperation({
    summary: 'Create a new recipe',
    description:
      'Creates a recipe in the declared `source_lang`, verifies language via LibreTranslate, validates catalog references, generates automated multilingual translations for all supported locales, and stores relational records.',
  })
  @ApiCreatedResponse({
    description: 'Recipe successfully created',
    type: LocalizedRecipeDetailResponse,
  })
  @ApiBadRequestResponse({
    description:
      'Validation failed on inputs or referenced catalog items do not exist',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Create, 'Recipe')
  @Post()
  addRecipe(
    @Body(ValidationPipe) createRecipeDto: CreateRecipeDto,
    @CurrentUser('id') id: number,
  ) {
    return this.recipeService.createRecipe(createRecipeDto, id);
  }

  /**
   * Retry failed automated translations for an existing recipe.
   */
  @ApiOperation({
    summary: 'Retry automated translations',
    description:
      'Re-triggers LibreTranslate for a recipe whose translation status is marked as failed.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiOkResponse({ description: 'Translation retry processed' })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Post(':id/translate')
  async retryTranslation(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.retryTranslation(recipeId, userId);
  }

  /**
   * Update an existing recipe.
   */
  @ApiOperation({
    summary: 'Update recipe details',
    description:
      'Modifies recipe attributes, steps, ingredients, or localized text. Optionally triggers full re-translation via `retranslate=true`.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiQuery({
    name: 'retranslate',
    required: false,
    description:
      'Set to "true" to re-generate automated translations for updated text',
    example: 'true',
  })
  @ApiOkResponse({
    description: 'Recipe updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid update payload',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Patch(':id')
  async updateRecipe(
    @Param('id', ParseIntPipe) recipeId: number,
    @Body(ValidationPipe) updateRecipeDto: UpdateRecipeDto,
    @CurrentUser('id') userId: number,
    @Query('retranslate') retranslate?: string,
  ) {
    const shouldRetranslate = retranslate === 'true' || retranslate === '1';
    return this.recipeService.updateRecipe(
      userId,
      recipeId,
      updateRecipeDto,
      shouldRetranslate,
    );
  }

  /**
   * Delete an existing recipe.
   */
  @ApiOperation({
    summary: 'Delete recipe',
    description:
      'Permanently deletes the recipe and all its steps, media, translations, and associated likes.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiOkResponse({
    description: 'Recipe deleted successfully',
    type: RecipeMessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Delete, 'Recipe')
  @Delete(':id')
  async deleteRecipe(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteRecipe(recipeId, userId);
  }

  /**
   * Upload recipe primary cover image.
   */
  @ApiOperation({
    summary: 'Upload recipe cover image',
    description:
      'Uploads and sets the primary hero cover photo for the recipe. Replaces any existing cover image.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, or WebP; maximum 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Cover image uploaded successfully',
    type: CoverImageUploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'File missing or invalid file format',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Post(':id/cover')
  @UseInterceptors(FileInterceptor('file', recipeImageMulterOptions))
  async uploadCoverImage(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.recipeService.uploadCoverImage(recipeId, userId, file);
  }

  /**
   * Upload recipe step illustration photo.
   */
  @ApiOperation({
    summary: 'Upload step illustration photo',
    description:
      'Uploads an illustration photo for a specific recipe preparation step (identified by step number).',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiParam({
    name: 'stepNumber',
    description: '1-based step sequence number',
    example: 1,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Step illustration photo (JPEG, PNG, or WebP; max 5MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Step illustration photo uploaded successfully',
    type: StepImageUploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'File missing or invalid image',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe or step not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Post(':id/steps/:stepNumber/image')
  @UseInterceptors(FileInterceptor('file', recipeImageMulterOptions))
  async uploadStepImage(
    @Param('id', ParseIntPipe) recipeId: number,
    @Param('stepNumber', ParseIntPipe) stepNumber: number,
    @CurrentUser('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.recipeService.uploadStepImage(
      recipeId,
      stepNumber,
      userId,
      file,
    );
  }

  /**
   * Upload up to 3 gallery photos for a recipe.
   */
  @ApiOperation({
    summary: 'Upload recipe gallery photos',
    description:
      'Uploads supplementary plating photos to the recipe gallery. Enforces a maximum limit of 3 gallery photos per recipe.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Gallery photos (up to 3 files total, max 5MB each)',
        },
      },
      required: ['files'],
    },
  })
  @ApiCreatedResponse({
    description: 'Gallery photos uploaded successfully',
    type: [RecipeMediaResponse],
  })
  @ApiBadRequestResponse({
    description: 'Maximum 3 gallery images exceeded or invalid format',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Post(':id/gallery')
  @UseInterceptors(FilesInterceptor('files', 3, recipeImageMulterOptions))
  async uploadGalleryMedia(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.recipeService.uploadGalleryMedia(recipeId, userId, files);
  }

  /**
   * Upload demonstration tutorial video for a recipe.
   */
  @ApiOperation({
    summary: 'Upload recipe tutorial video',
    description:
      'Uploads a single demonstration video for the recipe. Replaces any existing tutorial video.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Video file (MP4 or WebM format, max 100MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiCreatedResponse({
    description: 'Tutorial video uploaded successfully',
    type: VideoUploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'File missing or invalid video format',
    type: ApiErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Post(':id/video')
  @UseInterceptors(FileInterceptor('file', recipeVideoMulterOptions))
  async uploadVideo(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.recipeService.uploadVideo(recipeId, userId, file);
  }

  /**
   * Delete recipe cover image.
   */
  @ApiOperation({
    summary: 'Delete recipe cover image',
    description:
      'Removes the cover photo file from disk and nullifies the database reference.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiOkResponse({
    description: 'Cover image deleted',
    type: RecipeMessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Delete(':id/cover')
  async deleteCoverImage(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteCoverImage(recipeId, userId);
  }

  /**
   * Delete recipe tutorial video.
   */
  @ApiOperation({
    summary: 'Delete recipe tutorial video',
    description:
      'Removes the video file from storage and nullifies the database reference.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiOkResponse({
    description: 'Tutorial video deleted',
    type: RecipeMessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Delete(':id/video')
  async deleteVideo(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteVideo(recipeId, userId);
  }

  /**
   * Delete step illustration photo.
   */
  @ApiOperation({
    summary: 'Delete step illustration photo',
    description:
      'Removes the step illustration file from disk and nullifies step image_url.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiParam({
    name: 'stepNumber',
    description: '1-based step sequence number',
    example: 1,
  })
  @ApiOkResponse({
    description: 'Step image deleted',
    type: RecipeMessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe or step not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Delete(':id/steps/:stepNumber/image')
  async deleteStepImage(
    @Param('id', ParseIntPipe) recipeId: number,
    @Param('stepNumber', ParseIntPipe) stepNumber: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteStepImage(recipeId, stepNumber, userId);
  }

  /**
   * Delete an individual gallery photo by media ID.
   */
  @ApiOperation({
    summary: 'Delete gallery photo',
    description:
      'Deletes a specific gallery media photo from disk and database by its media ID.',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiParam({ name: 'mediaId', description: 'Gallery media ID', example: 3 })
  @ApiOkResponse({
    description: 'Gallery media photo deleted',
    type: RecipeMessageResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Recipe or media item not found',
    type: ApiErrorResponseDto,
  })
  @Auth(Action.Update, 'Recipe')
  @Delete(':id/gallery/:mediaId')
  async deleteGalleryMedia(
    @Param('id', ParseIntPipe) recipeId: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteGalleryMedia(recipeId, mediaId, userId);
  }

  /**
   * Like a recipe.
   */
  @ApiOperation({
    summary: 'Like recipe',
    description:
      'Registers a like association for the current authenticated user on the recipe (idempotent).',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiOkResponse({ description: 'Recipe liked', type: RecipeLikeResponseDto })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth()
  @Post(':id/like')
  async likeRecipe(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.likeRecipe(id, userId);
  }

  /**
   * Unlike a recipe.
   */
  @ApiOperation({
    summary: 'Unlike recipe',
    description:
      'Removes the like association for the current user from the recipe (idempotent).',
  })
  @ApiParam({ name: 'id', description: 'Recipe ID', example: 42 })
  @ApiOkResponse({ description: 'Recipe unliked', type: RecipeLikeResponseDto })
  @ApiNotFoundResponse({
    description: 'Recipe not found',
    type: ApiErrorResponseDto,
  })
  @Auth()
  @Delete(':id/like')
  async unlikeRecipe(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.unlikeRecipe(id, userId);
  }
}

/* 
In NestJS, l’ordine dei decoratori conta perché le route vengono confrontate
in sequenza. Se avessi prima una route con parametro, come @Get(':name'),
e poi una route più specifica, il framework potrebbe interpretare quella 
specifica come parte del parametro di :name, invece di riconoscerla come 
una rotta distinta. Per questo è importante mettere prima le rotte statiche
e poi quelle dinamiche.

Esempio:

@Get() → route fissa
@Get(':name') → route dinamica
Se la dinamica venisse prima, potrebbe “rubare” anche le 
richieste delle altre route 
*/
