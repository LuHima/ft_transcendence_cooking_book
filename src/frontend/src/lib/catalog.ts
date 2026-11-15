// Helpers for the public, paginated catalog endpoints:
//   GET /tags?page=&limit=&lang=&search=&sort_by=name|slug&sort_order=asc|desc        → PaginatedTagsResponseDto
//   GET /ingredients?page=&limit=&lang=&search=&category=&sort_by=&sort_order=       → PaginatedIngredientsResponseDto
//   GET /ingredients/:id?lang=                                                       → CatalogIngredient
import { useCallback, useEffect, useState } from 'react'
import { api, qs, toPage } from '../api/client'
import type { CatalogIngredient, CatalogTag, IngredientCategory, Lang, Paginated } from '../types/models'
import { useDebouncedValue } from './useDebouncedValue'

// Backend maximum (PaginationQueryDto @Max(100))
export const CATALOG_MAX_LIMIT = 100
// Safety net: tags are a small curated set, never loop forever on a misbehaving backend
const MAX_TAG_PAGES = 20

// Tags are a small curated set: load them all (100 per page) so selectors stay usable past the default limit=20
export async function fetchAllTags(lang: Lang, signal?: AbortSignal): Promise<CatalogTag[]> {
	const all: CatalogTag[] = []
	for (let page = 1; page <= MAX_TAG_PAGES; page++) {
		const res = await api.get<unknown>(
			`/tags${qs({ lang, page, limit: CATALOG_MAX_LIMIT, sort_by: 'name', sort_order: 'asc' })}`,
			{ signal },
		)
		const data = toPage<CatalogTag>(res, CATALOG_MAX_LIMIT)
		all.push(...data.items)
		if (!data.has_next_page) break
	}
	return all
}

export interface IngredientSearchParams {
	search?: string
	lang: Lang
	page?: number
	limit?: number
	category?: IngredientCategory | ''
}

// One page of server-side ingredient search (alphabetical by localized name)
export async function searchIngredients(
	{ search, lang, page = 1, limit = 20, category }: IngredientSearchParams,
	signal?: AbortSignal,
): Promise<Paginated<CatalogIngredient>> {
	const res = await api.get<unknown>(
		`/ingredients${qs({ search: search?.trim(), lang, page, limit, category, sort_by: 'name', sort_order: 'asc' })}`,
		{ signal },
	)
	return toPage<CatalogIngredient>(res, limit)
}

// Localized names for ingredient IDs that are not in any loaded page (URL params, existing recipes).
// IDs that cannot be resolved are simply missing from the result.
export async function fetchIngredientsByIds(ids: number[], lang: Lang, signal?: AbortSignal): Promise<Map<number, CatalogIngredient>> {
	const settled = await Promise.allSettled(
		ids.map((id) => api.get<CatalogIngredient>(`/ingredients/${id}${qs({ lang })}`, { signal })),
	)
	const map = new Map<number, CatalogIngredient>()
	settled.forEach((r, i) => {
		if (r.status === 'fulfilled' && r.value && typeof r.value.name === 'string') map.set(ids[i], r.value)
	})
	return map
}

interface IngredientSearchState {
	// Request that produced this state (query|lang): a mismatch means a new search is in flight
	key: string
	items: CatalogIngredient[]
	page: number
	hasNext: boolean
	error: boolean
}

// Debounced async ingredient search for comboboxes: only runs while `enabled` (e.g. the list is open),
// fetches the first page for the current text (empty text = top of the alphabetical list),
// and appends further pages on demand with loadMore().
export function useIngredientSearch(text: string, lang: Lang, enabled: boolean, limit = 20) {
	const query = useDebouncedValue(text.trim(), 300)
	const key = `${query}|${lang}`
	const [state, setState] = useState<IngredientSearchState | null>(null)
	const [loadingMore, setLoadingMore] = useState(false)

	useEffect(() => {
		if (!enabled) return
		const controller = new AbortController()
		searchIngredients({ search: query, lang, page: 1, limit }, controller.signal)
			.then((data) => {
				if (controller.signal.aborted) return
				setState({ key, items: data.items, page: data.page, hasNext: data.has_next_page, error: false })
			})
			.catch(() => {
				if (controller.signal.aborted) return
				setState({ key, items: [], page: 1, hasNext: false, error: true })
			})
		return () => controller.abort()
	}, [enabled, query, lang, limit, key])

	const current = state?.key === key ? state : null

	const loadMore = useCallback(async () => {
		if (!current || !current.hasNext || loadingMore) return
		setLoadingMore(true)
		try {
			const data = await searchIngredients({ search: query, lang, page: current.page + 1, limit })
			setState((prev) =>
				prev && prev.key === key
					? { ...prev, items: [...prev.items, ...data.items.filter((i) => !prev.items.some((p) => p.id === i.id))], page: data.page, hasNext: data.has_next_page }
					: prev,
			)
		} catch {
			// Keep the already loaded options
		} finally {
			setLoadingMore(false)
		}
	}, [current, loadingMore, query, lang, limit, key])

	return {
		items: current?.items ?? [],
		// Waiting for the debounce or for the response
		loading: enabled && (current === null || text.trim() !== query),
		error: current?.error ?? false,
		hasMore: current?.hasNext ?? false,
		loadingMore,
		loadMore,
	}
}
