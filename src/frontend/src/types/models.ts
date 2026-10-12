export type RecipeDifficulty = 'easy' | 'medium' | 'hard'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type UserRole = 'admin' | 'user'
export type UserStatus = 'active' | 'disabled' | 'banned'

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
	role: UserRole
	// assente = attivo. Se 'disabled' o 'banned' il backend deve rifiutare il login.
	status?: UserStatus
	created_at?: string
}

// profilo visibile agli altri utenti: nessun dato sensibile (email, anagrafica…)
export interface PublicUser {
	id: number
	username: string
	avatar_url?: string | null
	recipes_count?: number
	followers_count?: number
	following_count?: number
	// io seguo lui / lui segue me. Se entrambi veri sono "amici".
	is_following?: boolean
	follows_me?: boolean
}

export type UserSummary = Pick<PublicUser, 'id' | 'username' | 'avatar_url'>

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
	user?: Pick<User, 'id' | 'username' | 'avatar_url'> | null
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

export interface RecipeComment {
	id: number
	recipe_id: number
	user_id: number
	content: string
	created_at: string
	user: Pick<User, 'id' | 'username' | 'avatar_url'>
}

export type NotificationType = 'like' | 'comment'

export interface AppNotification {
	id: number
	type: NotificationType
	is_read: boolean
	created_at: string
	actor: Pick<User, 'id' | 'username'>
	recipe: Pick<Recipe, 'id' | 'title'>
}

// commento con contesto, usato nella moderazione admin
export interface AdminComment extends RecipeComment {
	recipe?: Pick<Recipe, 'id' | 'title'>
}
