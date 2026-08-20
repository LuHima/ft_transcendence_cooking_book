import { Controller, Get, Param} from '@nestjs/common';
import { RecipeService } from './recipe.service';

@Controller('recipe')
export class RecipeController 
{

    constructor(private readonly recipeService: RecipeService) {}
    
    @Get('recipes')
    async getRicette()
    {
        return await this.recipeService.getAllRecipe();
    }
    @Get('recipe/:name')
    async getRicetta(@Param('name') name: string)
    {
        return await this.recipeService.getRecipe(name);
    }
}
