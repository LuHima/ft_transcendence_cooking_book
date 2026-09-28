import { Injectable, BadRequestException, NotFoundException} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma, Recipe } from '@prisma/client';
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
		return await this.prisma.recipe.findMany({select: {id: true, title: true}});
	}

	public async getRecipeStack(page: number)
	{
		let limit: number = 30;
	
		if (!page || page < 1) {
			throw new BadRequestException('Page number must be greater than 0');
		}
		let recipes =  await this.prisma.recipe.findMany({
			skip: (page - 1) * limit,
			take: limit + 1,
			select: {
				id: true,
				title: true,
				description: true,
				user: {
					select: {
						username: true,
					},
				}, 
				
			},
			orderBy: {
			  id: 'asc',
			},

		});
		if (recipes.length === 0 )
			throw new NotFoundException('Recipes not found');

		const hasNextPage = recipes.length > limit;
  
		const hasPreviousPage = page > 1;

		const items = hasNextPage ? recipes.slice(0, limit) : recipes;

		let returnPage = items.map(({ user, ...recipe }) => ({ //map è un metodo degli array che ritorna un nuovo array modificato come richiesta (Non modifica l'oggetto attuale)
			...recipe,
			username: user?.username ?? null,
		}));
		return {returnPage, hasNextPage, hasPreviousPage};
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

	async createRecipe(recipe: CreateRecipeDto, userId: number)
	{
		return await this.prisma.recipe.create({
			data: {
				title: recipe.title,
				user_id: userId,
			} 
		});
	}


	async updateRecipe(userId: number, recipeId :number, recipeUpdate: Prisma.RecipeUpdateInput)
	{
		const recipe = await this.prisma.recipe.findUnique({
			where: {
				id: recipeId
			}
		})

		if(!recipe || recipe.user_id != userId)
			throw new NotFoundException('Recipe not found');

		return await this.prisma.recipe.update({
			where: {
				id: recipeId
			},
			data: recipeUpdate
		});
	}

	async deleteRecipe(recipeId :number, userId: number)
	{ 
		const recipe = await this.prisma.recipe.findUnique({
			where: {
				id: recipeId
			}
		})

		if(!recipe || recipe.user_id != userId)
			throw new NotFoundException('Recipe not found');

		return await this.prisma.recipe.delete({
			where: {
				id: recipeId
			}
		});
	}
}
