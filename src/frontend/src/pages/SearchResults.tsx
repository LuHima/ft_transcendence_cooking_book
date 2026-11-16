import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RecipeCard from '../components/RecipeCard'
import Avatar from '../components/Avatar'
import Pagination from '../components/Pagination'
import RecipeSortSelect from '../components/RecipeSortSelect'
import IngredientMultiPicker from '../components/IngredientMultiPicker'
import AuthorPicker from '../components/AuthorPicker'
import { RecipeGridSkeleton } from '../components/Skeleton'
import { api, getErrorMessage, qs, toPage } from '../api/client'
import { fetchAllTags, fetchIngredientsByIds } from '../lib/catalog'
import { useLang } from '../lib/useLang'
import { SUPPORTED_LANGS } from '../i18n'
import { DEFAULT_RECIPE_SORT, parseRecipeSort } from '../lib/recipeSort'
import type {
	CatalogIngredient,
	CatalogTag,
	Course,
	Lang,
	Paginated,
	RecipeDifficulty,
	RecipeSummary,
	SortOrder,
	UserSearchResult,
	UserSortBy,
} from '../types/models'

const PAGE_SIZE = 12
const USERS_PAGE_SIZE = 6
// GET /users?search= rejects (400) searches shorter than 2 characters
const MIN_USER_SEARCH = 2
const COURSES: Course[] = ['appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack']
const DIFFICULTIES: RecipeDifficulty[] = ['easy', 'medium', 'hard']

const USER_SORT_OPTIONS = [
	{ value: 'username:asc', label: 'usernameAsc' },
	{ value: 'username:desc', label: 'usernameDesc' },
	{ value: 'recipes_count:desc', label: 'mostRecipes' },
	{ value: 'created_at:desc', label: 'newestMembers' },
	{ value: 'created_at:asc', label: 'oldestMembers' },
] as const
const DEFAULT_USER_SORT = USER_SORT_OPTIONS[0].value

type MatchMode = 'all' | 'any'

const SELECT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'

const idList = (raw: string | null) =>
	(raw ?? '')
		.split(',')
		.filter(Boolean)
		.map(Number)
		.filter((n) => Number.isInteger(n) && n > 0)

const nonNegInt = (raw: string | null) => (raw && /^\d+$/.test(raw) ? raw : '')
// IDs (e.g. author_id) must be >= 1 (backend Min(1)): author=0 is ignored
const posInt = (raw: string | null) => (raw && /^\d+$/.test(raw) && Number(raw) > 0 ? String(Number(raw)) : '')

// Duration inputs (min) update the URL only after typing pauses
const DURATION_DEBOUNCE_MS = 500
const DURATION_KEYS = ['min_time', 'max_time', 'max_prep_time'] as const
type DurationKey = (typeof DURATION_KEYS)[number]
type Durations = Record<DurationKey, string>
const EMPTY_NAMES: ReadonlyMap<number, string> = new Map()
// URL params that count as active filters (q and sorting do not)
const FILTER_PARAMS = ['course', 'difficulty', 'min_time', 'max_time', 'max_prep_time', 'curated', 'src', 'author', 'tags', 'xtags', 'ings', 'xings']

// "All / any" toggle for tags and ingredients
function MatchModeToggle({ value, onChange, label }: { value: MatchMode; onChange: (v: MatchMode) => void; label: string }) {
	const { t } = useTranslation()
	return (
		<div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-full border border-[var(--wc-border)] text-xs">
			{(['all', 'any'] as const).map((m) => (
				<button
					key={m}
					type="button"
					role="radio"
					aria-checked={value === m}
					onClick={() => onChange(m)}
					className={`px-3 py-1 transition-colors ${
						value === m ? 'bg-[var(--wc-basil)] text-[var(--wc-bg)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'
					}`}
				>
					{t(`search.matchMode.${m}`)}
				</button>
			))}
		</div>
	)
}

// Advanced search: filters and sorting live in the URL, so results are shareable and Back works.
// URL params → GET /recipes:
//   q→search  course  difficulty  min_time  max_time  max_prep_time  curated→curated_only
//   tags→tag_ids  xtags→exclude_tag_ids  tag_mode
//   ings→ingredient_ids  xings→exclude_ingredient_ids  ing_mode→ingredient_mode
//   src→source_lang  author→author_id
//   sort→sort_by+sort_order  page   (usort = user sorting)
function SearchResults() {
	const { t } = useTranslation()
	const lang = useLang()
	const [params, setParams] = useSearchParams()

	const query = params.get('q') ?? ''
	const trimmedQuery = query.trim()
	const course = params.get('course') ?? ''
	const difficulty = params.get('difficulty') ?? ''
	const minTime = nonNegInt(params.get('min_time'))
	const maxTime = nonNegInt(params.get('max_time'))
	const maxPrepTime = nonNegInt(params.get('max_prep_time'))
	const curatedOnly = params.get('curated') === '1'
	const sourceLangParam = params.get('src') ?? ''
	const sourceLang = (SUPPORTED_LANGS as string[]).includes(sourceLangParam) ? sourceLangParam : ''
	const authorId = posInt(params.get('author'))
	const tagIds = idList(params.get('tags'))
	const excludeTagIds = idList(params.get('xtags')).filter((id) => !tagIds.includes(id))
	const tagMode: MatchMode = params.get('tag_mode') === 'any' ? 'any' : 'all'
	const ingredientIds = idList(params.get('ings'))
	const excludeIngredientIds = idList(params.get('xings')).filter((id) => !ingredientIds.includes(id))
	const ingredientMode: MatchMode = params.get('ing_mode') === 'any' ? 'any' : 'all'
	const { value: sort, sortBy, sortOrder } = parseRecipeSort(params.get('sort'))
	const userSortParam = params.get('usort') ?? ''
	const userSort = USER_SORT_OPTIONS.some((o) => o.value === userSortParam) ? userSortParam : DEFAULT_USER_SORT
	const [userSortBy, userSortOrder] = userSort.split(':') as [UserSortBy, SortOrder]
	const page = Math.max(1, Number(params.get('page')) || 1)

	// Tags: small curated set loaded in full; tagged with the language (and retry count) that produced it
	const [tagsState, setTagsState] = useState<{ key: string; items: CatalogTag[]; error: boolean } | null>(null)
	const [tagsReload, setTagsReload] = useState(0)
	// Names of the selected ingredients (URL IDs are hydrated with GET /ingredients/:id), per language
	const [ingredientNames, setIngredientNames] = useState<{ lang: Lang; map: ReadonlyMap<number, string> }>({ lang, map: new Map() })
	// Result tagged with the request that produced it: a key mismatch with the current filters means it is still loading
	const [result, setResult] = useState<{
		key: string
		data: Paginated<RecipeSummary> | null
		users: Paginated<UserSearchResult> | null
		error: string | null
	} | null>(null)
	const [loadingMoreUsers, setLoadingMoreUsers] = useState(false)
	// filters already in the URL (shared link, Back): open the panel so they are visible
	const [showFilters, setShowFilters] = useState(() => FILTER_PARAMS.some((k) => params.get(k)))

	function update(patch: Record<string, string | null>, keepPage = false) {
		const next = new URLSearchParams(params)
		for (const [key, value] of Object.entries(patch)) {
			if (value) next.set(key, value)
			else next.delete(key)
		}
		if (!keepPage) next.delete('page')
		setParams(next)
	}

	// Three-state tags: none → included → excluded → none (include and exclude never overlap)
	function cycleTag(id: number) {
		if (tagIds.includes(id)) {
			update({ tags: tagIds.filter((x) => x !== id).join(',') || null, xtags: [...excludeTagIds, id].join(',') })
		} else if (excludeTagIds.includes(id)) {
			update({ xtags: excludeTagIds.filter((x) => x !== id).join(',') || null })
		} else {
			update({ tags: [...tagIds, id].join(',') })
		}
	}

	// Inline keyword input, synced with ?q= (also when the navbar SearchBar submits a new search)
	const [keyword, setKeyword] = useState(query)
	const [prevQuery, setPrevQuery] = useState(query)
	if (query !== prevQuery) {
		setPrevQuery(query)
		setKeyword(query)
	}

	function submitKeyword(e: FormEvent) {
		e.preventDefault()
		const next = keyword.trim()
		if (next !== trimmedQuery) update({ q: next || null })
	}

	// Duration inputs: local values, written to the URL after a pause (no request per keystroke)
	const urlDurations: Durations = { min_time: minTime, max_time: maxTime, max_prep_time: maxPrepTime }
	const urlDurationsKey = DURATION_KEYS.map((k) => urlDurations[k]).join('|')
	const [durations, setDurations] = useState<Durations>(urlDurations)
	const [prevDurationsKey, setPrevDurationsKey] = useState(urlDurationsKey)
	if (urlDurationsKey !== prevDurationsKey) {
		// Changed from outside (clear filters, Back): adopt the URL values
		setPrevDurationsKey(urlDurationsKey)
		setDurations(urlDurations)
	}
	const localDurationsKey = DURATION_KEYS.map((k) => durations[k]).join('|')

	useEffect(() => {
		if (localDurationsKey === urlDurationsKey) return
		const id = window.setTimeout(() => {
			const values = localDurationsKey.split('|')
			setParams((prev) => {
				const next = new URLSearchParams(prev)
				DURATION_KEYS.forEach((k, i) => {
					if (values[i]) next.set(k, values[i])
					else next.delete(k)
				})
				next.delete('page')
				return next
			})
		}, DURATION_DEBOUNCE_MS)
		return () => window.clearTimeout(id)
	}, [localDurationsKey, urlDurationsKey, setParams])

	const tagsKey = `${lang}|${tagsReload}`
	useEffect(() => {
		const controller = new AbortController()
		fetchAllTags(lang, controller.signal)
			.then((items) => {
				if (!controller.signal.aborted) setTagsState({ key: tagsKey, items, error: false })
			})
			.catch(() => {
				if (!controller.signal.aborted) setTagsState({ key: tagsKey, items: [], error: true })
			})
		return () => controller.abort()
	}, [lang, tagsKey])
	const tagsCurrent = tagsState?.key === tagsKey ? tagsState : null
	const tags = tagsCurrent?.items ?? []

	// Ingredient names: picked ones are remembered, IDs coming from the URL are fetched one by one
	const namesMap = ingredientNames.lang === lang ? ingredientNames.map : EMPTY_NAMES
	const missingIngredientKey = [...ingredientIds, ...excludeIngredientIds].filter((id) => !namesMap.has(id)).join(',')
	useEffect(() => {
		if (!missingIngredientKey) return
		const controller = new AbortController()
		const ids = missingIngredientKey.split(',').map(Number)
		fetchIngredientsByIds(ids, lang, controller.signal)
			.then((found) => {
				if (controller.signal.aborted || found.size === 0) return
				setIngredientNames((prev) => {
					const map = new Map(prev.lang === lang ? prev.map : [])
					found.forEach((ing, id) => map.set(id, ing.name))
					return { lang, map }
				})
			})
			.catch(() => {
				// Chips fall back to #id
			})
		return () => controller.abort()
	}, [missingIngredientKey, lang])

	function rememberIngredient(i: CatalogIngredient) {
		setIngredientNames((prev) => ({ lang, map: new Map(prev.lang === lang ? prev.map : []).set(i.id, i.name) }))
	}

	const tagKey = tagIds.join(',')
	const xTagKey = excludeTagIds.join(',')
	const ingKey = ingredientIds.join(',')
	const xIngKey = excludeIngredientIds.join(',')
	const searchUsers = trimmedQuery.length >= MIN_USER_SEARCH && page === 1
	const requestKey = [
		trimmedQuery,
		course,
		difficulty,
		minTime,
		maxTime,
		maxPrepTime,
		curatedOnly,
		sourceLang,
		authorId,
		tagKey,
		xTagKey,
		tagMode,
		ingKey,
		xIngKey,
		ingredientMode,
		sort,
		userSort,
		page,
		lang,
	].join('|')

	const timeRangeInvalid = Boolean(minTime && maxTime && Number(minTime) > Number(maxTime))

	useEffect(() => {
		// Contradictory range (min > max): no request, the UI asks to fix it
		if (timeRangeInvalid) return
		let cancelled = false

		const recipesRequest = api.get<Paginated<RecipeSummary>>(
			`/recipes${qs({
				page,
				limit: PAGE_SIZE,
				lang,
				search: trimmedQuery,
				course,
				difficulty,
				min_time: minTime,
				max_time: maxTime,
				max_prep_time: maxPrepTime,
				// curated_only requires lang (always sent)
				curated_only: curatedOnly ? 'true' : undefined,
				source_lang: sourceLang,
				author_id: authorId || undefined,
				tag_ids: tagKey,
				tag_mode: tagKey ? tagMode : undefined,
				exclude_tag_ids: xTagKey,
				ingredient_ids: ingKey,
				ingredient_mode: ingKey ? ingredientMode : undefined,
				exclude_ingredient_ids: xIngKey,
				sort_by: sortBy,
				sort_order: sortOrder,
			})}`,
		)
		// Users: GET /users (paginated) only with at least 2 characters and on the first page;
		// if it fails the recipes are still shown
		const usersRequest = searchUsers
			? api
					.get<unknown>(
						`/users${qs({ search: trimmedQuery, page: 1, limit: USERS_PAGE_SIZE, sort_by: userSortBy, sort_order: userSortOrder })}`,
					)
					.then((d) => toPage<UserSearchResult>(d, USERS_PAGE_SIZE))
					.catch(() => null)
			: Promise.resolve(null)

		Promise.all([recipesRequest, usersRequest])
			.then(([recipes, users]) => {
				if (cancelled) return
				setResult({ key: requestKey, data: recipes, users, error: null })
			})
			.catch((err) => {
				if (cancelled) return
				setResult({ key: requestKey, data: null, users: null, error: getErrorMessage(err, t('search.error')) })
			})

		return () => {
			cancelled = true
		}
	}, [
		trimmedQuery,
		course,
		difficulty,
		minTime,
		maxTime,
		maxPrepTime,
		curatedOnly,
		sourceLang,
		authorId,
		tagKey,
		xTagKey,
		tagMode,
		ingKey,
		xIngKey,
		ingredientMode,
		sortBy,
		sortOrder,
		searchUsers,
		userSortBy,
		userSortOrder,
		page,
		lang,
		requestKey,
		timeRangeInvalid,
		t,
	])

	// "Show more users": next page of GET /users appended to the list
	async function loadMoreUsers() {
		const current = result?.users
		if (!current || !current.has_next_page) return
		setLoadingMoreUsers(true)
		try {
			const d = await api.get<unknown>(
				`/users${qs({
					search: trimmedQuery,
					page: current.page + 1,
					limit: USERS_PAGE_SIZE,
					sort_by: userSortBy,
					sort_order: userSortOrder,
				})}`,
			)
			const next = toPage<UserSearchResult>(d, USERS_PAGE_SIZE)
			setResult((prev) =>
				prev && prev.users ? { ...prev, users: { ...next, items: [...prev.users.items, ...next.items] } } : prev,
			)
		} catch {
			// Fail silently: keep the already loaded list
		} finally {
			setLoadingMoreUsers(false)
		}
	}

	const activeFilters =
		[course, difficulty, minTime, maxTime, maxPrepTime, sourceLang, authorId].filter(Boolean).length +
		(curatedOnly ? 1 : 0) +
		tagIds.length +
		excludeTagIds.length +
		ingredientIds.length +
		excludeIngredientIds.length
	// Warning follows what is typed, before the debounce writes it to the URL
	const typedRangeInvalid = Boolean(
		durations.min_time && durations.max_time && Number(durations.min_time) > Number(durations.max_time),
	)
	const current = timeRangeInvalid ? null : result?.key === requestKey ? result : null
	const data = current?.data ?? null
	const users = current?.users?.items ?? []
	const usersPage = current?.users ?? null
	const error = current?.error ?? null
	const loading = current === null && !timeRangeInvalid
	const hasResults = (data?.items.length ?? 0) > 0 || users.length > 0

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">
				{query ? t('search.resultsFor', { query }) : t('search.allRecipes')}
			</h1>

			{/* Keyword editable directly on the search page (synced with ?q=) */}
			<form role="search" onSubmit={submitKeyword} className="mt-6 flex max-w-xl items-center">
				<div className="relative flex-1">
					<input
						type="search"
						value={keyword}
						onChange={(e) => setKeyword(e.target.value)}
						placeholder={t('search.placeholder')}
						aria-label={t('search.keyword')}
						className="w-full rounded-l-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4 py-2 pr-9 text-sm text-[var(--wc-text)] outline-none placeholder:text-[var(--wc-text-muted)] focus:border-[var(--wc-basil)] [&::-webkit-search-cancel-button]:hidden"
					/>
					{keyword && (
						<button
							type="button"
							onClick={() => {
								setKeyword('')
								if (trimmedQuery) update({ q: null })
							}}
							aria-label={t('search.clearKeyword')}
							className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-lg leading-none text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]"
						>
							×
						</button>
					)}
				</div>
				<button
					type="submit"
					className="rounded-r-full border border-l-0 border-[var(--wc-border)] bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)]"
				>
					{t('search.button')}
				</button>
			</form>

			<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
				<button
					type="button"
					onClick={() => setShowFilters((v) => !v)}
					aria-expanded={showFilters}
					aria-controls="search-filters"
					className="rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm text-[var(--wc-text)] hover:border-[var(--wc-basil)]"
				>
					{t('search.filters')}
					{activeFilters > 0 && ` (${activeFilters})`}
				</button>
				<RecipeSortSelect
					value={sort}
					onChange={(v) => update({ sort: v === DEFAULT_RECIPE_SORT ? null : v })}
				/>
			</div>

			{showFilters && (
				<div id="search-filters" className="mt-3 space-y-5 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
						<label className="text-xs text-[var(--wc-text-muted)]">
							{t('recipe.course')}
							<select value={course} onChange={(e) => update({ course: e.target.value || null })} className={`${SELECT} mt-1 w-full`}>
								<option value="">{t('search.any')}</option>
								{COURSES.map((c) => (
									<option key={c} value={c}>
										{t(`course.${c}`)}
									</option>
								))}
							</select>
						</label>
						<label className="text-xs text-[var(--wc-text-muted)]">
							{t('recipe.difficulty')}
							<select
								value={difficulty}
								onChange={(e) => update({ difficulty: e.target.value || null })}
								className={`${SELECT} mt-1 w-full`}
							>
								<option value="">{t('search.any')}</option>
								{DIFFICULTIES.map((d) => (
									<option key={d} value={d}>
										{t(`difficulty.${d}`)}
									</option>
								))}
							</select>
						</label>
						<label className="text-xs text-[var(--wc-text-muted)]">
							{t('search.minTime')}
							<input
								type="number"
								min={0}
								step={5}
								value={durations.min_time}
								placeholder="10"
								aria-invalid={typedRangeInvalid}
								onChange={(e) => {
									const v = e.target.value.replace(/\D/g, '')
									setDurations((prev) => ({ ...prev, min_time: v }))
								}}
								className={`${SELECT} mt-1 w-full`}
							/>
						</label>
						<label className="text-xs text-[var(--wc-text-muted)]">
							{t('search.maxTime')}
							<input
								type="number"
								min={0}
								step={5}
								value={durations.max_time}
								placeholder="30"
								aria-invalid={typedRangeInvalid}
								onChange={(e) => {
									const v = e.target.value.replace(/\D/g, '')
									setDurations((prev) => ({ ...prev, max_time: v }))
								}}
								className={`${SELECT} mt-1 w-full`}
							/>
						</label>
						<label className="text-xs text-[var(--wc-text-muted)]">
							{t('search.maxPrepTime')}
							<input
								type="number"
								min={0}
								step={5}
								value={durations.max_prep_time}
								placeholder="15"
								onChange={(e) => {
									const v = e.target.value.replace(/\D/g, '')
									setDurations((prev) => ({ ...prev, max_prep_time: v }))
								}}
								className={`${SELECT} mt-1 w-full`}
							/>
						</label>
					</div>
					{(typedRangeInvalid || timeRangeInvalid) && (
						<p role="alert" className="text-xs text-[var(--wc-paprika)]">
							{t('search.timeRangeInvalid')}
						</p>
					)}

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
						<label className="text-xs text-[var(--wc-text-muted)]">
							{t('search.sourceLang')}
							<select value={sourceLang} onChange={(e) => update({ src: e.target.value || null })} className={`${SELECT} mt-1 w-full`}>
								<option value="">{t('search.any')}</option>
								{SUPPORTED_LANGS.map((l) => (
									<option key={l} value={l}>
										{t(`lang.${l}`)}
									</option>
								))}
							</select>
						</label>
						<div className="sm:col-span-2 lg:col-span-2">
							<AuthorPicker
								authorId={authorId ? Number(authorId) : null}
								onChange={(id) => update({ author: id ? String(id) : null })}
							/>
						</div>
					</div>

					<label className="flex cursor-pointer items-start gap-2 text-sm text-[var(--wc-text)]">
						<input
							type="checkbox"
							className="mt-1"
							checked={curatedOnly}
							onChange={(e) => update({ curated: e.target.checked ? '1' : null })}
						/>
						<span>
							{t('search.curatedOnly')}
							<span className="block text-xs text-[var(--wc-text-muted)]">
								{t('search.curatedOnlyHelp', { lang: t(`langInline.${lang}`) })}
							</span>
						</span>
					</label>

					<div>
						<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs text-[var(--wc-text-muted)]">
								{t('form.tags')} <span className="opacity-80">· {t('search.tagHelp')}</span>
							</p>
							<MatchModeToggle
								label={t('search.tagMode')}
								value={tagMode}
								onChange={(m) => update({ tag_mode: m === 'all' ? null : m })}
							/>
						</div>
						{tagsCurrent === null ? (
							<p role="status" className="text-sm text-[var(--wc-text-muted)]">
								{t('search.tagsLoading')}
							</p>
						) : tagsCurrent.error ? (
							<p role="alert" className="text-sm text-[var(--wc-paprika)]">
								{t('search.tagsUnavailable')}{' '}
								<button type="button" onClick={() => setTagsReload((n) => n + 1)} className="text-[var(--wc-saffron)] underline">
									{t('search.retry')}
								</button>
							</p>
						) : tags.length === 0 ? (
							<p className="text-sm text-[var(--wc-text-muted)]">{t('form.noTags')}</p>
						) : (
							<ul className="flex flex-wrap gap-2">
								{tags.map((tag) => {
									const included = tagIds.includes(tag.id)
									const excluded = excludeTagIds.includes(tag.id)
									return (
										<li key={tag.id}>
											<button
												type="button"
												onClick={() => cycleTag(tag.id)}
												aria-label={`${tag.name}: ${t(
													included ? 'search.tagState.included' : excluded ? 'search.tagState.excluded' : 'search.tagState.none',
												)}`}
												className={`rounded-full border px-3 py-1 text-sm transition-colors ${
													included
														? 'border-[var(--wc-basil)] bg-[var(--wc-basil)] text-[var(--wc-bg)]'
														: excluded
															? 'border-[var(--wc-paprika)] text-[var(--wc-paprika)] line-through'
															: 'border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-basil)]'
												}`}
											>
												{excluded && '− '}
												{tag.name}
											</button>
										</li>
									)
								})}
							</ul>
						)}
					</div>

					<div className="space-y-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs text-[var(--wc-text-muted)]">{t('search.pantry')}</p>
							<MatchModeToggle
								label={t('search.ingredientMode')}
								value={ingredientMode}
								onChange={(m) => update({ ing_mode: m === 'all' ? null : m })}
							/>
						</div>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<IngredientMultiPicker
								label={t('search.includeIngredients')}
								names={namesMap}
								onPick={rememberIngredient}
								selectedIds={ingredientIds}
								disabledIds={excludeIngredientIds}
								onChange={(ids) => update({ ings: ids.join(',') || null })}
							/>
							<IngredientMultiPicker
								label={t('search.excludeIngredients')}
								tone="exclude"
								names={namesMap}
								onPick={rememberIngredient}
								selectedIds={excludeIngredientIds}
								disabledIds={ingredientIds}
								onChange={(ids) => update({ xings: ids.join(',') || null })}
							/>
						</div>
					</div>

					{activeFilters > 0 && (
						<button
							type="button"
							onClick={() => {
								setDurations({ min_time: '', max_time: '', max_prep_time: '' })
								update({
									course: null,
									difficulty: null,
									min_time: null,
									max_time: null,
									max_prep_time: null,
									curated: null,
									src: null,
									author: null,
									tags: null,
									xtags: null,
									tag_mode: null,
									ings: null,
									xings: null,
									ing_mode: null,
								})
							}}
							className="text-sm text-[var(--wc-saffron)] hover:underline"
						>
							{t('search.clearFilters')}
						</button>
					)}
				</div>
			)}

			{timeRangeInvalid && <p className="mt-8 text-[var(--wc-paprika)]">{t('search.timeRangeInvalid')}</p>}
			{error && <p className="mt-8 text-[var(--wc-paprika)]">{error}</p>}
			{loading && (
				<div className="mt-8">
					<RecipeGridSkeleton count={6} />
				</div>
			)}
			{!loading && !error && !timeRangeInvalid && !hasResults && (
				<p className="mt-8 text-[var(--wc-text-muted)]">{query || activeFilters > 0 ? t('search.noResults') : t('home.empty')}</p>
			)}
			{trimmedQuery.length > 0 && trimmedQuery.length < MIN_USER_SEARCH && (
				<p className="mt-4 text-xs text-[var(--wc-text-muted)]">{t('search.userMinChars', { count: MIN_USER_SEARCH })}</p>
			)}

			{users.length > 0 && (
				<section className="mt-8">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h2 className="font-display text-xl text-[var(--wc-saffron)]">
							{t('search.users')}
							{usersPage && <span className="ml-2 text-sm text-[var(--wc-text-muted)]">({usersPage.total})</span>}
						</h2>
						<label className="flex items-center gap-2 text-sm text-[var(--wc-text-muted)]">
							{t('search.sortBy')}
							<select
								value={userSort}
								onChange={(e) => update({ usort: e.target.value === DEFAULT_USER_SORT ? null : e.target.value })}
								className={SELECT}
							>
								{USER_SORT_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{t(`search.userSort.${o.label}`)}
									</option>
								))}
							</select>
						</label>
					</div>
					<ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{users.map((u) => {
							const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ')
							return (
								<li key={u.id}>
									<Link
										to={`/users/${u.id}`}
										className="flex items-center gap-3 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3 transition-colors hover:border-[var(--wc-basil)]"
									>
										<Avatar username={u.username} url={u.avatar_url} className="h-10 w-10 text-base" />
										<span className="min-w-0 flex-1">
											<span className="block truncate font-medium text-[var(--wc-text)]">{u.username}</span>
											<span className="block truncate text-xs text-[var(--wc-text-muted)]">
												{fullName && `${fullName} · `}
												{t('profile.recipesCount', { count: u.recipes_count ?? 0 })}
											</span>
										</span>
										{u.friendship_status && u.friendship_status !== 'none' && (
											<span className="shrink-0 rounded-full border border-[var(--wc-border)] px-2 py-0.5 text-[10px] uppercase text-[var(--wc-saffron)]">
												{t(`friends.status.${u.friendship_status}`)}
											</span>
										)}
									</Link>
								</li>
							)
						})}
					</ul>
					{usersPage?.has_next_page && (
						<button
							type="button"
							onClick={() => void loadMoreUsers()}
							disabled={loadingMoreUsers}
							className="mt-3 text-sm text-[var(--wc-saffron)] hover:underline disabled:opacity-50"
						>
							{loadingMoreUsers ? t('common.loading') : t('search.moreUsers')}
						</button>
					)}
				</section>
			)}

			{data && data.items.length > 0 && (
				<>
					{users.length > 0 && <h2 className="mt-8 font-display text-xl text-[var(--wc-saffron)]">{t('search.recipes')}</h2>}
					<p className="mt-4 text-sm text-[var(--wc-text-muted)]">{t('search.count', { count: data.total })}</p>
					<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{data.items.map((recipe) => (
							<RecipeCard key={recipe.id} recipe={recipe} />
						))}
					</div>
					<Pagination page={data.page} totalPages={data.total_pages} onChange={(p) => update({ page: p > 1 ? String(p) : null }, true)} />
				</>
			)}
		</div>
	)
}

export default SearchResults
