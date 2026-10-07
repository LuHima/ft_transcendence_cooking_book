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
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  recipeImageMulterOptions,
  recipeVideoMulterOptions,
} from './recipe-media.multer';
import { RecipeService } from './recipe.service';
import { CatalogService } from '../catalog/catalog.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { authenticate } from 'passport';
import { Auth } from 'src/common/decorators/policies.decorator';
import { Action } from 'src/auth/casl/action.enum';

@Controller('recipes')
export class RecipeController {
  constructor(
    private readonly recipeService: RecipeService,
    private readonly catalogService: CatalogService,
  ) {}

  // TODO @Roles(Role.admin)

  // GET /api/recipes -> get all recipes
  @Get()
  async getRecipes(@Query('lang') lang?: string) {
    return await this.recipeService.getAllRecipe(lang);
  }

  // GET /api/recipes/page?page=1 (or legacy ?value=1) -> get paginated recipe stack
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

  // GET /api/recipes/metadata -> get static enum metadata dictionaries
  @Get('metadata')
  getMetadata() {
    return this.catalogService.getMetadata();
  }

  // GET /api/recipe/search?value=name -> get recipe by name
  // TODO Implement advanced search filters
  @Get('search')
  async getRecipe(@Query('value') name: string) {
    if (!name) return [];
    return await this.recipeService.getRecipesByName(name);
  }

  // GET /api/recipes/:id?lang=it|en|fr -> get localized recipe identified by id
  @Get(':id')
  async getRecipeById(
    @Param('id', ParseIntPipe) id: number,
    @Query('lang') lang?: string,
  ) {
    return await this.recipeService.getRecipeById(Number(id), lang);
  }

  // POST /api/recipes -> create a new recipe
  @Auth(Action.Create, 'Recipe')
  @Post()
  addRecipe(
    @Body(ValidationPipe) createRecipeDto: CreateRecipeDto,
    @CurrentUser('id') id: number,
  ) {
    return this.recipeService.createRecipe(createRecipeDto, id);
  }

  // POST /api/recipes/:id/translate -> retry failed translations
  @Auth(Action.Update, 'Recipe')
  @Post(':id/translate')
  async retryTranslation(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.retryTranslation(recipeId, userId);
  }

  // PATCH /api/recipes/:id -> modify an existent recipe
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

  // DELETE /api/recipes/:id -> delete an existent recipe
  @Auth(Action.Delete, 'Recipe')
  @Delete(':id')
  async deleteRecipe(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteRecipe(recipeId, userId);
  }

  // POST /api/recipes/:id/cover -> upload recipe cover image
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

  // POST /api/recipes/:id/steps/:stepNumber/image -> upload step
  // illustration
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

  // POST /api/recipes/:id/gallery -> upload up to 3 gallery photos
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

  // POST /api/recipes/:id/video -> upload single tutorial video
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

  // DELETE /api/recipes/:id/cover -> delete recipe cover image
  @Auth(Action.Update, 'Recipe')
  @Delete(':id/cover')
  async deleteCoverImage(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteCoverImage(recipeId, userId);
  }

  // DELETE /api/recipes/:id/video -> delete recipe tutorial video
  @Auth(Action.Update, 'Recipe')
  @Delete(':id/video')
  async deleteVideo(
    @Param('id', ParseIntPipe) recipeId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteVideo(recipeId, userId);
  }

  // DELETE /api/recipes/:id/steps/:stepNumber/image -> delete step illustration
  @Auth(Action.Update, 'Recipe')
  @Delete(':id/steps/:stepNumber/image')
  async deleteStepImage(
    @Param('id', ParseIntPipe) recipeId: number,
    @Param('stepNumber', ParseIntPipe) stepNumber: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteStepImage(recipeId, stepNumber, userId);
  }

  // DELETE /api/recipes/:id/gallery/:mediaId -> delete individual gallery photo
  @Auth(Action.Update, 'Recipe')
  @Delete(':id/gallery/:mediaId')
  async deleteGalleryMedia(
    @Param('id', ParseIntPipe) recipeId: number,
    @Param('mediaId', ParseIntPipe) mediaId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.deleteGalleryMedia(recipeId, mediaId, userId);
  }

  // POST /api/recipes/:id/like -> like a recipe
  @Auth()
  @Post(':id/like')
  async likeRecipe(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.recipeService.likeRecipe(id, userId);
  }

  // DELETE /api/recipes/:id/like -> unlike a recipe
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
