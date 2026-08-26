import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
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
        return	this.prisma.recipe.findMany();
    }
    
    async getRecipesByName(name :string)
    {
        const recipe = this.prisma.recipe.findMany({
            where: {
                title: name
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
        const recipe = this.prisma.recipe.findUnique({
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

        return this.prisma.recipe.delete({
            where: {
                id: id
            }
        });
    }
}
