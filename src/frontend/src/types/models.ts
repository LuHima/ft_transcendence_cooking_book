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
	bio?: string | null
	created_at?: string
}

// ─── amicizie ───
// stato dell'amicizia rispetto all'utente loggato, restituito direttamente da GET /users/:id e GET /users
// (null se non si è loggati o si guarda il proprio profilo)
export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends'

// profilo pubblico (PublicUserResponseDto): nessun dato sensibile (email, anagrafica…)
export interface PublicUser {
	id: number
	username: string
	first_name?: string | null
	last_name?: string | null
	avatar_url?: string | null
	bio?: string | null
	created_at?: string
	recipes_count?: number
	friends_count?: number
	total_likes_received?: number
	friendship_status?: FriendshipStatus | null
}

// GET /friends → FriendItemDto
export interface FriendItem {
	id: number
	username: string
	avatar_url: string | null
	friends_since: string
}

// GET /friends/requests → FriendRequestItemDto. NB: `id` è l'id dell'utente controparte
// (mittente per le richieste ricevute, destinatario per quelle inviate), non della richiesta
export interface FriendRequest {
	id: number
	username: string
	avatar_url: string | null
	created_at: string
}

export type UserSummary = Pick<PublicUser, 'id' | 'username' | 'avatar_url'>

// GET /users?search= → PaginatedUsersResponseDto (items: UserSearchItemDto)
export type UserSortBy = 'username' | 'recipes_count' | 'created_at'
export type SortOrder = 'asc' | 'desc'

export interface UserSearchResult {
	id: number
	username: string
	first_name: string | null
	last_name: string | null
	avatar_url: string | null
	created_at?: string
	recipes_count: number
	friendship_status?: FriendshipStatus | null
}

// GET /users/me/blocks → PaginatedBlockedUsersResponseDto
export interface BlockedUser {
	id: number
	username: string
	avatar_url: string | null
	blocked_at: string
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

// ordinamenti accettati da GET /recipes, /users/:id/recipes, /users/me/recipes
export type RecipeSortBy = 'created_at' | 'total_time' | 'difficulty' | 'likes_count' | 'title'

// provenienza del testo nella lingua mostrata
export type TranslationSource = 'author_original' | 'manual' | 'machine'

export interface AvailableLanguage {
	locale: Lang
	translation_source: TranslationSource
}

export interface RecipeSummary {
	id: number
	// false = ricetta sospesa (soft delete / moderazione): visibile solo ad autore e staff
	is_active?: boolean
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
	available_languages?: AvailableLanguage[]
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
	translation_source?: TranslationSource
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

// ─── gestione catalogo (solo admin): /api/admin/catalog/(ingredients|tags)[/:id] ───
// GET /admin/catalog/ingredients/:id → IngredientDetailResponseDto, GET /admin/catalog/tags/:id → TagDetailResponseDto
// (con tutte le traduzioni); POST, PATCH e DELETE sotto lo stesso prefisso. Gli elenchi restano GET /ingredients e GET /tags.
export interface CatalogTranslations {
	it: string
	en: string
	fr: string
}

// body di POST /ingredients
export interface CreateIngredientDto {
	slug: string
	category: IngredientCategory
	translations: CatalogTranslations
}

// body di PATCH /ingredients/:id (slug e categoria non modificabili)
export interface UpdateIngredientDto {
	translations: CatalogTranslations
}

export interface IngredientDetailResponseDto {
	id: number
	slug: string
	category: IngredientCategory
	translations: CatalogTranslations
}

// body di POST /tags
export interface CreateTagDto {
	slug: string
	translations: CatalogTranslations
}

// body di PATCH /tags/:id (slug non modificabile)
export interface UpdateTagDto {
	translations: CatalogTranslations
}

export interface TagDetailResponseDto {
	id: number
	slug: string
	translations: CatalogTranslations
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
	replies_count: number
	has_more_replies: boolean
	replies: ApiComment[]
}

export interface PaginatedRecipeComments {
	items: ThreadedComment[]
	total: number
	page: number
	limit: number
	total_pages: number
	has_next_page: boolean
	has_prev_page: boolean
}

export interface PaginatedCommentReplies {
	items: ApiComment[]
	total: number
	page: number
	limit: number
	total_pages: number
	has_next_page: boolean
	has_prev_page: boolean
}

// notifiche: ricalcano NotificationItemDto del backend (GET /api/notifications)
export type NotificationSubject = 'recipe' | 'comment' | 'user'
export type NotificationAction =
	| 'like'
	| 'comment'
	| 'friend_request'
	| 'friend_accept'
	| 'post'
	| 'update'
	| 'delete'
	// avviso di un moderatore dopo una segnalazione (testo in `details`)
	| 'warn'

export interface AppNotification {
	id: number
	user_id: number
	subject: NotificationSubject
	action: NotificationAction
	actor: { id: number; username: string; avatar_url: string | null } | null
	// target: ricetta / commento / utente a cui si riferisce la notifica
	// recipe_id: ricetta che contiene il commento (per subject 'comment'), o la ricetta stessa
	target: {
		id: number | null
		subject: NotificationSubject
		title_or_snippet: string | null
		recipe_id?: number | null
	} | null
	// testo aggiuntivo (es. messaggio del moderatore per 'warn')
	details?: string | null
	// testo già localizzato dal backend (in base a ?lang=)
	message: string
	is_read: boolean
	created_at: string
}

// risposta paginata di GET /api/notifications
export interface PaginatedNotifications {
	items: AppNotification[]
	total: number
	page: number
	limit: number
	total_pages: number
	has_next_page: boolean
	has_prev_page: boolean
	unread_count: number
}

// ─── audit commenti admin (GET /admin/comments → AdminCommentItemDto) ───
export type AdminCommentSortBy = 'created_at' | 'reports_count' | 'recipe'
export type AdminCommentFormat = 'flat' | 'threaded'
export type AdminCommentStatus = 'active' | 'inactive' | 'all'

export interface AdminComment {
	id: number
	recipe_id: number
	user_id: number | null
	parent_id: number | null
	content: string
	is_active: boolean
	is_edited: boolean
	created_at: string
	updated_at: string | null
	reports_count: number
	// segnalazioni ancora da gestire su questo commento
	pending_reports_count?: number
	has_pending_reports?: boolean
	user: RecipeAuthor | null
	recipe: { id: number; title: string } | null
	// solo con format=threaded (ThreadedAdminCommentItemDto)
	replies_count?: number
	// risposte con almeno una segnalazione in attesa
	reported_replies_count?: number
	// segnalazioni in attesa su tutta la conversazione (radice + risposte)
	thread_pending_reports_count?: number
	has_more_replies?: boolean
	replies?: AdminComment[]
}

// ─── ricette admin (GET /admin/recipes = filtri di GET /recipes + status) ───
export type AdminRecipeStatus = 'all' | 'active' | 'inactive'

// ─── gestione utenti admin (GET /admin/users → AdminUserResponseDto) ───
export interface AdminUser extends User {
	status: UserStatus
	recipes_count?: number
	banned_until?: string | null
	previous_bans_count?: number
	deleted_at?: string | null
}

// GET /admin/users/:id/ban-history → BanHistoryItemDto[]
export interface BanHistoryItem {
	id: string
	user_id: number
	banned_by_id: number
	report_id: number | null
	reason: ReportReason
	description: string | null
	duration_days: number | null
	is_permanent: boolean
	banned_at: string
	expires_at: string | null
	unbanned_at: string | null
	unbanned_by_id: number | null
	unban_reason: string | null
}

// ─── segnalazioni e moderazione (allineate a CreateReportDto / UpdateReportDto / ReportItemDto) ───

export type ReportSubject = 'recipe' | 'comment' | 'user'
export type ReportReason =
	| 'spam_scam'
	| 'harassment_bullying'
	| 'hate_speech'
	| 'sexual_content'
	| 'violence_threats'
	| 'copyright_infringement'
	| 'impersonation_misinformation'
	| 'other'
export const REPORT_REASONS: ReportReason[] = [
	'spam_scam',
	'harassment_bullying',
	'hate_speech',
	'sexual_content',
	'violence_threats',
	'copyright_infringement',
	'impersonation_misinformation',
	'other',
]
// 'reviewed' esiste nel backend ma non è usato dal pannello
export type ReportStatus = 'pending' | 'reviewed' | 'action_taken' | 'dismissed'
// dismiss = archivia; warn = avviso; delete_content = sospende ricetta/commento; ban = banna l'autore
export type ModerationAction = 'dismiss' | 'warn' | 'delete_content' | 'ban'

// body di POST /reports
export interface CreateReportDto {
	subject: ReportSubject
	target_id: number
	reason: ReportReason
	// max 1000 caratteri
	description?: string
}

// body di PATCH /reports/:id
export interface UpdateReportDto {
	status: 'action_taken' | 'dismissed'
	actions: ModerationAction[]
	// obbligatorio con status === 'action_taken'
	resolution_reason?: ReportReason
	// spiegazione mostrata all'utente sanzionato
	resolution_description?: string
	// note interne dello staff
	resolution_notes?: string
	// max 180 per i moderatori
	ban_duration_days?: number
	// solo admin
	permanent?: boolean
}

// utente idratato dal backend (segnalatore o autore del contenuto)
export interface ReportUser {
	id: number
	username: string
	avatar_url: string | null
}

// contesto del contenuto segnalato (ReportTargetSummaryDto), label localizzata con ?lang=
export interface ReportTarget {
	// titolo ricetta, estratto del commento o username
	label: string
	// per i commenti: ricetta che li contiene; per le ricette: la ricetta stessa
	recipe_id?: number
	// autore del contenuto (chi riceverebbe avvisi / ban)
	owner?: ReportUser | null
}

export interface ReportItem {
	id: number
	reporter_id: number
	reporter?: ReportUser | null
	subject: ReportSubject
	target_id: number
	target?: ReportTarget | null
	reason: ReportReason
	description: string | null
	status: ReportStatus
	resolution_reason: ReportReason | null
	resolution_description: string | null
	resolution_notes: string | null
	previous_bans_count?: number | null
	resolved_by_id: number | null
	resolved_at: string | null
	created_at: string
	updated_at?: string
}

// ─── account bannato: 403 { code: 'ACCOUNT_BANNED', details } da /auth/signin e /auth/signin/google ───
export interface AccountBannedDetails {
	reason: ReportReason
	description: string | null
	// ISO, null se permanente
	banned_until: string | null
	is_permanent: boolean
}

// risposta di POST /users/me/avatar e POST /admin/users/:id/avatar
export interface AvatarUploadResponseDto {
	avatar_url: string
}
