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

// Recipe privacy (RecipePrivacy, ADR 0027): public / confirmed friends only / private
export type RecipePrivacy = 'public' | 'friends_only' | 'private'
export const RECIPE_PRIVACIES: RecipePrivacy[] = ['public', 'friends_only', 'private']

// Profile privacy (ProfilePrivacy): who can see the cookbook, friends and personal data
export type ProfilePrivacy = 'public' | 'friends_only' | 'private'
export const PROFILE_PRIVACIES: ProfilePrivacy[] = ['public', 'friends_only', 'private']

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
	// Missing = active. 'disabled' and 'banned' accounts cannot sign in.
	status?: UserStatus
	// May be missing from GET /users/me: the Profile page then infers it from the 409 responses of enable/disable
	is_two_factor_enabled?: boolean
	// Culinary bio (max 500 characters)
	bio?: string | null
	profile_privacy?: ProfilePrivacy
	created_at?: string
}

// PATCH /users/me body (UpdateUserDto): send only the changed fields
export interface UpdateUserDto {
	username?: string
	email?: string
	bio?: string
	profile_privacy?: ProfilePrivacy
	first_name?: string
	last_name?: string
	birth_date?: string
	phone?: string
	address?: string
	city?: string
	postal_code?: string
}

// ─── friendships ───
// Friendship status relative to the signed-in user, returned by GET /users/:id and GET /users
// (null when signed out or on your own profile).
export type FriendshipStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends'

// Public profile (PublicUserResponseDto): no sensitive data (email, personal details…)
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
	profile_privacy?: ProfilePrivacy
	// Personal data: null in a degraded profile when privacy hides it
	city?: string | null
}

// GET /friends → FriendItemDto
export interface FriendItem {
	id: number
	username: string
	avatar_url: string | null
	friends_since: string
}

// GET /friends/requests → FriendRequestItemDto. NB: `id` is the other user's ID
// (sender for incoming, recipient for outgoing requests), not the request's.
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

// ─── recipes (LocalizedRecipeSummaryResponse / LocalizedRecipeDetailResponse) ───

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

// Sort fields accepted by GET /recipes, /users/:id/recipes and /users/me/recipes
export type RecipeSortBy = 'created_at' | 'total_time' | 'difficulty' | 'likes_count' | 'title'

// Provenance of the text in the displayed language
export type TranslationSource = 'author_original' | 'manual' | 'machine'

export interface AvailableLanguage {
	locale: Lang
	translation_source: TranslationSource
}

export interface RecipeSummary {
	id: number
	// false = suspended recipe (soft delete / moderation): visible only to the author and staff
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
	// null = platform recipe
	author: RecipeAuthor | null
	title: string
	description: string
	tags: RecipeTag[]
	likes_count: number
	comments_count: number
	is_liked: boolean
	resolved_lang: Lang
	available_languages?: AvailableLanguage[]
	privacy?: RecipePrivacy
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

// Alias kept for pages that only show title/ID
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

// ─── catalog management (admins only): /api/admin/catalog/(ingredients|tags)[/:id] ───
// Detail endpoints return every translation; lists stay on GET /ingredients and GET /tags.
export interface CatalogTranslations {
	it: string
	en: string
	fr: string
}

export interface CreateIngredientDto {
	slug: string
	category: IngredientCategory
	translations: CatalogTranslations
}

// PATCH body (slug and category are immutable)
export interface UpdateIngredientDto {
	translations: CatalogTranslations
}

export interface IngredientDetailResponseDto {
	id: number
	slug: string
	category: IngredientCategory
	translations: CatalogTranslations
}

export interface CreateTagDto {
	slug: string
	translations: CatalogTranslations
}

// PATCH body (slug is immutable)
export interface UpdateTagDto {
	translations: CatalogTranslations
}

export interface TagDetailResponseDto {
	id: number
	slug: string
	translations: CatalogTranslations
}

// Body of POST /api/recipes and PATCH /api/recipes/:id
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
	privacy?: RecipePrivacy
}

// ─── comments (GET /recipes/:id/comments → two-level tree) ───

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
	// null when the comment was deactivated but is kept for thread context
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

// Notifications (NotificationItemDto, GET /api/notifications)
export type NotificationSubject = 'recipe' | 'comment' | 'user'
export type NotificationAction =
	| 'like'
	| 'comment'
	| 'friend_request'
	| 'friend_accept'
	| 'post'
	| 'update'
	| 'delete'
	// Moderator warning after a report (text in `details`)
	| 'warn'

export interface AppNotification {
	id: number
	user_id: number
	subject: NotificationSubject
	action: NotificationAction
	actor: { id: number; username: string; avatar_url: string | null } | null
	// Recipe, comment or user the notification refers to.
	// recipe_id: recipe containing the comment (subject 'comment') or the recipe itself.
	target: {
		id: number | null
		subject: NotificationSubject
		title_or_snippet: string | null
		recipe_id?: number | null
	} | null
	// Extra text (e.g. the moderator's message for 'warn')
	details?: string | null
	// Already localized by the backend (?lang=)
	message: string
	is_read: boolean
	created_at: string
}

// Paginated response of GET /api/notifications
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

// ─── admin comment audit (GET /admin/comments → AdminCommentItemDto) ───
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
	// Reports still pending on this comment
	pending_reports_count?: number
	has_pending_reports?: boolean
	user: RecipeAuthor | null
	recipe: { id: number; title: string } | null
	// Only with format=threaded (ThreadedAdminCommentItemDto)
	replies_count?: number
	// Replies with at least one pending report
	reported_replies_count?: number
	// Pending reports across the whole conversation (root + replies)
	thread_pending_reports_count?: number
	has_more_replies?: boolean
	replies?: AdminComment[]
}

// ─── admin recipes (GET /admin/recipes = GET /recipes filters + status) ───
export type AdminRecipeStatus = 'all' | 'active' | 'inactive'

// ─── admin user management (GET /admin/users → AdminUserResponseDto) ───
export interface AdminUser extends User {
	status: UserStatus
	recipes_count?: number
	banned_until?: string | null
	previous_bans_count?: number
	previous_warnings_count?: number
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

// ─── reports and moderation (CreateReportDto / UpdateReportDto / ReportItemDto) ───

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
// 'reviewed' exists on the backend but is not used by the panel
export type ReportStatus = 'pending' | 'reviewed' | 'action_taken' | 'dismissed'
// dismiss = archive; warn = warning; delete_content = suspend recipe/comment; ban = ban the owner
export type ModerationAction = 'dismiss' | 'warn' | 'delete_content' | 'ban'

export interface CreateReportDto {
	subject: ReportSubject
	target_id: number
	reason: ReportReason
	// Max 1000 characters
	description?: string
}

export interface UpdateReportDto {
	status: 'action_taken' | 'dismissed'
	actions: ModerationAction[]
	// Required when status === 'action_taken'
	resolution_reason?: ReportReason
	// Explanation shown to the sanctioned user
	resolution_description?: string
	// Internal staff notes
	resolution_notes?: string
	// Max 180 for moderators
	ban_duration_days?: number
	// Admins only
	permanent?: boolean
}

// User hydrated by the backend (reporter or content owner)
export interface ReportUser {
	id: number
	username: string
	avatar_url: string | null
}

// Reported content context (ReportTargetSummaryDto), label localized with ?lang=
export interface ReportTarget {
	// Recipe title, comment excerpt or username
	label: string
	// Comments: the recipe containing them; recipes: the recipe itself
	recipe_id?: number
	// Content owner (who would receive warnings / bans)
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
	// Warnings already received by the owner (to spot repeat offenders)
	previous_warnings_count?: number | null
	// Actions taken on resolution (e.g. ['delete_content', 'warn'])
	actions?: ModerationAction[]
	resolved_by_id: number | null
	resolved_at: string | null
	created_at: string
	updated_at?: string
}

// ─── banned account: 403 { code: 'ACCOUNT_BANNED', details } from /auth/signin and /auth/signin/google ───
export interface AccountBannedDetails {
	reason: ReportReason
	description: string | null
	// ISO date, null when permanent
	banned_until: string | null
	is_permanent: boolean
}

// Response of POST /users/me/avatar and POST /admin/users/:id/avatar
export interface AvatarUploadResponseDto {
	avatar_url: string
}
