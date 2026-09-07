import { Injectable, BadRequestException, NotFoundException} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma, Recipe } from '@prisma/client';
import { CreateRecipeDto } from './dto/create-recipe.dto';

export type RecipeTitleOnly = Pick<Recipe, 'title'>;  

@Injectable()
export class RecipeService {

    constructor(private prisma: PrismaService) {}

    public async getAllRecipe(who?: 'user' | 'id') // ! who e' solo per testare  
    {
        if(who)
        {
            return "hello";
        }
        return await this.prisma.recipe.findMany();
    }

    public async getRecipeStack(page: number)
    {
        let limit: number = 30;
    
        if (!page || page < 1) {
            throw new BadRequestException('Page number must be greater than 0');
        }
        let return_page:  RecipeTitleOnly[]=  await this.prisma.recipe.findMany({
            skip: (page - 1) * limit,          
            take: limit + 1,
            select: {
                title: true,
            },
            orderBy: {
              id: 'asc',
            },

        });
        if (return_page.length === 0 )
            throw new NotFoundException('Recipes not found');

        const hasNextPage = return_page.length > limit;           
  
        const hasPreviousPage = page > 1;
  
        return_page = hasNextPage ? return_page.slice(0, limit) : return_page;

        return {return_page, hasNextPage, hasPreviousPage};

    }

    async getRecipesByName(name :string)
    {
        const recipe = await this.prisma.recipe.findMany({
            where: {
                title: {
                    contains: name,
                    mode: 'insensitive', 
                },
            },
            select: {
                id: true,
                title: true,
                description: true
            }
        })
        return recipe;
    }

    async getRecipeById(id :number)
    {
        const recipe = await this.prisma.recipe.findUnique({
            where: {
                id: id
            }
        })

        if(!recipe)
            throw new NotFoundException('Recipe not found');

        return recipe;
    }

	async createRecipe(recipe: CreateRecipeDto)
	{
		return await this.prisma.recipe.create({
			data: recipe
		});
	}


    async updateRecipe(id :number, recipeUpdate: Prisma.RecipeUpdateInput)
    {
        const recipe = await this.prisma.recipe.findUnique({
            where: {
                id
            }
        })

        if(!recipe)
            throw new NotFoundException('Recipe not found');

        return await this.prisma.recipe.update({
            where: {id},
            data: recipeUpdate
        });
    }

    async deleteRecipe(id :number)//TODO
    { 
        const recipe = this.prisma.recipe.findUnique({
            where: {
                id: id
            }
        })

        if(!recipe)
            throw new NotFoundException('Recipe not found');

        return await this.prisma.recipe.delete({
            where: {
                id: id
            }
        });
    }
}
