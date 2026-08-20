import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecipeService {

    constructor(private prisma: PrismaService) {}

    public async getAllRecipe()
    {
        return	this.prisma.recipe.findMany();
    }
    
    async getRecipe(name :string)
    {
        return this.prisma.recipe.findFirst({
            where: {
                title: name
            }
        })
    }

}
