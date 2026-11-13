import type { RecipeSortBy, SortOrder } from '../types/models'

// Sort options accepted by the backend (sort_by + sort_order) on GET /recipes, /users/:id/recipes and /users/me/recipes.
// Values are "field:direction"; the first one is the default (created_at desc) and is not written to the URL.
export const RECIPE_SORT_OPTIONS = [
	{ value: 'created_at:desc', label: 'newest' },
	{ value: 'created_at:asc', label: 'oldest' },
	{ value: 'total_time:asc', label: 'quickest' },
	{ value: 'total_time:desc', label: 'longest' },
	{ value: 'difficulty:asc', label: 'easiest' },
	{ value: 'difficulty:desc', label: 'hardest' },
	{ value: 'likes_count:desc', label: 'mostLiked' },
	{ value: 'title:asc', label: 'titleAsc' },
	{ value: 'title:desc', label: 'titleDesc' },
] as const

export type RecipeSortValue = (typeof RECIPE_SORT_OPTIONS)[number]['value']
export const DEFAULT_RECIPE_SORT: RecipeSortValue = 'created_at:desc'

// Validates any value (e.g. from the URL) and splits it into sort_by / sort_order
export function parseRecipeSort(value: string | null | undefined): {
	value: RecipeSortValue
	sortBy: RecipeSortBy
	sortOrder: SortOrder
} {
	const valid = RECIPE_SORT_OPTIONS.find((o) => o.value === value)?.value ?? DEFAULT_RECIPE_SORT
	const [sortBy, sortOrder] = valid.split(':') as [RecipeSortBy, SortOrder]
	return { value: valid, sortBy, sortOrder }
}
