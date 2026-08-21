import { Controller, Get, Param, Post, Body, Patch, Delete, Query} from '@nestjs/common';
import { RecipeService } from './recipe.service';

@Controller('recipes')
export class RecipeController 
{

    constructor(private readonly recipeService: RecipeService) {}
    

    @Get('/id/:id')
    async getRecipeById(@Param('id') id: number)
    {
        return await this.recipeService.getRecipeById(Number(id));
    }

    @Get()
    async getRecipes(@Query("who") who?: 'user' | 'id')
    {

        return await this.recipeService.getAllRecipe();
    }

    @Get(':name')
    async getRecipe(@Param('name') name: string)
    {
        return await this.recipeService.getRecipesByName(name);
    }


    // ---------------------------------------------------------------------
    // TODO
    @Post() //aggiunge
    addRecipe(@Body()recipe: {})
    {
        return recipe; 
    }
    @Patch(':id') // modifica una ricetta 
    async updateRecipe(@Param('id') id: number, @Body() recipeUpdate: {})
    {
        this.recipeService.getRecipeById(id)
        return({id, ...recipeUpdate})
    }
    @Delete(':id') // cancella una ricetta 
    async deleteRecipe(@Param('id') id: number)
    {
        return(this.recipeService.deleteRecipe(Number(id)))
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
