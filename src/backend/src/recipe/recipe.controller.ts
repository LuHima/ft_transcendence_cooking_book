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
} from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { authenticate } from 'passport';
import { Auth } from 'src/common/decorators/policies.decorator';
import { Action } from 'src/auth/casl/action.enum';

@Controller('recipes')
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  // TODO @Roles(Role.admin)

  // GET /api/recipes -> get all recipes
  @Get()
  async getRecipes() {
    return await this.recipeService.getAllRecipe();
  }

  // GET /api/recipes/page?value=id -> get recipe identified by id ???
  @Get('page')
  async getRecipeStack(@Query('value') id: number) {
    if (!id) return [];
    return await this.recipeService.getRecipeStack(id);
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
