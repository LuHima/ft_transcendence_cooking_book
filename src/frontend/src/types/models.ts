export type Lang = 'it' | 'en' | 'fr'

export type RecipeDifficulty = 'easy' | 'medium' | 'hard'
export type Course = 'appetizer' | 'first_course' | 'main_course' | 'dessert' | 'side_dish' | 'drink' | 'snack' | 'sauce'
export type Unit =
	| 'g'
	| 'kg'
	| 'ml'
	| 'cl'
	| 'l'
	| 'oz'
	| 'lb'
	| 'fl_oz'
	| 'cup'
	| 'tbsp'
	| 'tsp'
	| 'piece'
	| 'pinch'
export type IngredientCategory =
	| 'produce'
	| 'dairy_eggs'
	| 'meat_poultry'
	| 'seafood'
	| 'bakery_grains'
	| 'pantry_spices'
	| 'legumes_nuts'
	| 'beverages_liquids'
	| 'other'
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

// pubblica / privata / solo amici. NB: non ancora presente nelle API (vedi src/config.ts)
export type RecipeVisibility = 'public' | 'private' | 'friends'

export type UserRole = 'admin' | 'moderator' | 'user'
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
	// non è ancora nella risposta di GET /users/me: se assente la pagina Profilo ricava lo stato dalle risposte 409 di enable/disable
	is_two_factor_enabled?: boolean
	created_at?: string
}

// ─── amicizie (richiesta → accettata = amici; rifiutata = non amici) ───
export type FriendshipStatus = 'none' | 'pending' | 'accepted' | 'rejected'

// stato dell'amicizia tra l'utente loggato e il profilo visitato
export interface Friendship {
	status: FriendshipStatus
	// solo per 'pending': chi ha inviato la richiesta (sent = io, received = l'altro utente)
	direction?: 'sent' | 'received'
	request_id?: number
}

// profilo visibile agli altri utenti: nessun dato sensibile (email, anagrafica…)
export interface PublicUser {
	id: number
	username: string
	avatar_url?: string | null
	created_at?: string
	recipes_count?: number
	friends_count?: number
	// assente se non si è loggati o si guarda il proprio profilo
	friendship?: Friendship
}

export interface FriendRequest {
	id: number
	user: Pick<PublicUser, 'id' | 'username' | 'avatar_url'>
	created_at: string
}

export type UserSummary = Pick<PublicUser, 'id' | 'username' | 'avatar_url'>

// GET /api/users?search= restituisce per ora SOLO { username }: id e avatar_url vanno richiesti al backend
export interface UserSearchResult {
	id?: number
	username: string
	avatar_url?: string | null
}

// ─── ricette (allineate a LocalizedRecipeSummaryResponse / LocalizedRecipeDetailResponse) ───

export interface RecipeAuthor {
	id: number
	username: string
	avatar_url: string | null
}

export interface RecipeTag {
	id: number
	slug: string
	name: string
}

export interface RecipeSummary {
	id: number
	course: Course
	difficulty: RecipeDifficulty
	prep_time: number
	cook_time: number
	total_time: number
	servings: number
	source_lang: Lang
	translation_status: 'completed' | 'failed'
	cover_image_url: string | null
	video_url: string | null
	created_at: string
	updated_at: string | null
	// null = ricetta della piattaforma
	author: RecipeAuthor | null
	title: string
	description: string
	tags: RecipeTag[]
	likes_count: number
	comments_count: number
	is_liked: boolean
	resolved_lang: Lang
	// non ancora esposto dalle API
	visibility?: RecipeVisibility
}

export interface RecipeStep {
	id: number
	step_number: number
	title: string | null
	description: string
	duration: number | null
	image_url: string | null
}

export interface RecipeIngredientItem {
	id: number
	slug: string
	category: IngredientCategory
	name: string
	quantity: number
	unit: Unit
	notes: unknown
}

export interface RecipeMedia {
	id: number
	url: string
	media_type: 'image' | 'video'
	order: number
}

export interface RecipeDetail extends RecipeSummary {
	preservation: string | null
	tips: string | null
	steps: RecipeStep[]
	ingredients: RecipeIngredientItem[]
	media: RecipeMedia[]
}

// alias: le pagine che mostrano solo titolo/ID continuano a usare "Recipe"
export type Recipe = RecipeSummary

export interface Paginated<T> {
	items: T[]
	total: number
	page: number
	limit: number
	total_pages: number
	has_next_page: boolean
	has_prev_page: boolean
}

export interface CatalogIngredient {
	id: number
	slug: string
	category: IngredientCategory
	name: string
}

export interface CatalogTag {
	id: number
	slug: string
	name: string
}

// body di POST /api/recipes e PATCH /api/recipes/:id
export interface CreateRecipeBody {
	title: string
	description: string
	preservation?: string
	tips?: string
	course: Course
	difficulty: RecipeDifficulty
	prep_time: number
	cook_time: number
	servings: number
	source_lang: Lang
	steps: { step_number: number; title?: string; description: string; duration?: number }[]
	ingredients: { ingredient_id: number; quantity: number; unit: Unit; notes?: unknown }[]
	tag_ids?: number[]
	visibility?: RecipeVisibility
}

// ─── commenti (GET /recipes/:id/comments → albero a 2 livelli) ───

export interface CommentUser {
	id: number
	username: string
	avatar_url?: string | null
}

export interface ApiComment {
	id: number
	recipe_id: number
	user_id: number | null
	parent_id: number | null
	// null quando il commento è stato disattivato ma serve per il contesto della discussione
	content: string | null
	is_active: boolean
	is_edited: boolean
	created_at: string
	updated_at: string | null
	user: CommentUser | null
}

export interface ThreadedComment extends ApiComment {
	replies: ApiComment[]
}

// commento "piatto" usato dalla moderazione admin (blocco 2)
export interface RecipeComment {
	id: number
	recipe_id: number
	user_id: number
	content: string
	created_at: string
	user: Pick<User, 'id' | 'username' | 'avatar_url'>
}

// notifiche: ricalcano il modello Notification del backend (subject + action + target_id)
export type NotificationSubject = 'recipe' | 'comment' | 'user'
export type NotificationAction = 'like' | 'comment' | 'friend_request' | 'friend_accept' | 'post'

export interface AppNotification {
	id: number
	subject: NotificationSubject
	action: NotificationAction
	target_id: number | null
	is_read: boolean
	created_at: string
	// può mancare finché il backend non include l'attore nella risposta
	actor?: { id: number; username: string; avatar_url?: string | null } | null
	// facoltativi: per le notifiche su commenti/ricette
	recipe_id?: number | null
	recipe_title?: string | null
}

export interface AdminComment extends RecipeComment {
	recipe?: Pick<RecipeSummary, 'id' | 'title'>
}

// ─── segnalazioni e moderazione (API da esporre lato backend, vedi CHANGES) ───

export type ReportTarget = 'recipe' | 'comment' | 'user'
export type ReportReason = 'spam' | 'offensive' | 'inappropriate' | 'copyright' | 'other'
export type ReportStatus = 'open' | 'resolved' | 'dismissed'
// dismiss = archivia senza azioni; warn = avviso all'utente; delete_content = rimuove ricetta/commento; ban = banna l'autore
export type ModerationAction = 'dismiss' | 'warn' | 'delete_content' | 'ban'

export interface Report {
	id: number
	target_type: ReportTarget
	target_id: number
	reason: ReportReason
	details: string | null
	status: ReportStatus
	created_at: string
	reporter: { id: number; username: string } | null
	// anteprima del contenuto segnalato: titolo ricetta, testo del commento o username
	target: {
		label: string
		// per i commenti: ricetta in cui si trova
		recipe_id?: number
		// utente responsabile del contenuto (a cui vanno avvisi / ban)
		owner?: { id: number; username: string } | null
	} | null
	resolved_by?: { id: number; username: string } | null
	resolution?: ModerationAction | null
}
