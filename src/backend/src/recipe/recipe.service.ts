import { Injectable, BadRequestException, NotFoundException} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { CreateRecipeDto } from './dto/create-recipe.dto';


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

/*     public async checkExistinRecipe(page: number)
    {
        if (!page || page < 1) {
            throw new BadRequestException('Page number must be greater than 0');
        }
        const return_page =  await this.prisma.recipe.findMany({
            skip: (page - 1) * 30,          
            take: 30,
            orderBy: {
              id: 'asc',
            },
        });
        if (return_page.length === 0 )
            throw new NotFoundException('Recipes not found');
        return true;
    } */

    public async getRecipeStack(page: number)
    {
        if (!page || page < 1) {
            throw new BadRequestException('Page number must be greater than 0');
        }
        const return_page =  await this.prisma.recipe.findMany({
            skip: (page - 1) * 30,          
            take: 30,
            orderBy: {
              id: 'asc',
            },
        });
        if (return_page.length === 0 )
            throw new NotFoundException('Recipes not found');
        return return_page;
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

        if(!recipe)
            throw new NotFoundException('Recipes not found');

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
