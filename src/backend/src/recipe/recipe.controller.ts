import { Controller, Get, Param, Post, Body, Patch, Delete, Query, ParseIntPipe, ValidationPipe, UseGuards} from '@nestjs/common';
import { RecipeService } from './recipe.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthGuard } from 'src/common/guards/auth.guard';

@Controller('recipes')
export class RecipeController 
{

	constructor(private readonly recipeService: RecipeService) {}
	
	// TODO @Roles(Role.admin)

	@Get()
	async getRecipes()
	{
		return await this.recipeService.getAllRecipe();
	}

	@Get('page')
	async getRecipeStack(@Query('value') id: number)
	{
		if (!id)
			return [];
		return await this.recipeService.getRecipeStack(id);
	}
	
	@Get('search')
	async getRecipe(@Query('value') name: string)
	{
		if (!name)
			return [];
		return await this.recipeService.getRecipesByName(name);
	}

	@Get(':id')
	async getRecipeById(@Param('id', ParseIntPipe) id: number)
	{
		return await this.recipeService.getRecipeById(Number(id));
	}

	@UseGuards(AuthGuard)
	@Post() //aggiunge
	addRecipe(@Body(ValidationPipe)createRecipeDto: CreateRecipeDto, @CurrentUser('id') id: number)
	{
		return this.recipeService.createRecipe(createRecipeDto, id); 
	}

	@UseGuards(AuthGuard)
	@Patch(':id') // modifica una ricetta 
	async updateRecipe(@Param('id', ParseIntPipe) recipeId: number, @Body(ValidationPipe) updateRecipeDto: UpdateRecipeDto, @CurrentUser('id')userId:number)
	{
		return this.recipeService.updateRecipe(userId, recipeId, updateRecipeDto)
	}
	@UseGuards(AuthGuard)
	@Delete(':id') // cancella una ricetta 
	async deleteRecipe(@Param('id', ParseIntPipe) recipeId: number, @CurrentUser('id') userId: number)
	{
		return(this.recipeService.deleteRecipe(recipeId, userId))
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
