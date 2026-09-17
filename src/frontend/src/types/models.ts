export type RecipeDifficulty = 'easy' | 'medium' | 'hard'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface User {
	id: number
	username: string
	email: string
	avatar_url?: string | null
	first_name?: string | null
	last_name?: string | null
	birth_date?: string | null
	phone?: string | null
	address?: string | null
	city?: string | null
	postal_code?: string | null
	role: 'admin' | 'user'
}

export interface RecipeIngredient {
	ingredient: { id: number; name: string }
	quantity: number
	unit: string
}

export interface RecipeMedia {
	id: number
	url: string
	media_type: 'image' | 'video'
	order: number
}

export interface Recipe {
	id: number
	title: string
	// alcuni endpoint (es. /recipes/search) restituiscono solo un sottoinsieme di campi:
	// questi sono quindi opzionali lato tipo anche se sempre presenti sul dettaglio completo.
	description?: string
	instructions?: string
	prep_time?: number
	difficulty?: RecipeDifficulty
	user_id?: number | null
	owner_type?: 'user' | 'platform'
	created_at?: string
	user?: Pick<User, 'id' | 'username'>
	recipe_ingredients?: RecipeIngredient[]
	recipe_media?: RecipeMedia[]
	likes_count?: number
	liked_by_me?: boolean
}

export interface IngredientInput {
	name: string
	quantity: number
	unit: string
}

export interface MealPlanEntry {
	recipe_id: number
	recipe_title?: string
	planned_date: string // ISO date (YYYY-MM-DD)
	meal_type: MealType
}

export interface MealPlan {
	id: number
	start_date: string
	end_date: string
	meal_plan_recipes: MealPlanEntry[]
}
