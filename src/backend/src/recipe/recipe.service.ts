import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
        return this.prisma.recipe.findMany({
            where: {
                title: name
            },
            select: {
                id: true,
                title: true,
                description: true
        }
        })
    }
    async getRecipeById(id :number)
    {
        return this.prisma.recipe.findUnique({
            where: {
                id: id
            }
        })
    }
    async deleteRecipe(id :number)//TODO
    { 
        return this.prisma.recipe.delete({
            where: {
                id: id
            }
        });
    }
}
