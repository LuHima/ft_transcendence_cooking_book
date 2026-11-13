import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RecipeCard from '../components/RecipeCard'
import Avatar from '../components/Avatar'
import Pagination from '../components/Pagination'
import RecipeSortSelect from '../components/RecipeSortSelect'
import IngredientMultiPicker from '../components/IngredientMultiPicker'
import { RecipeGridSkeleton } from '../components/Skeleton'
import { api, asArray, getErrorMessage, qs, toPage } from '../api/client'
import { useLang } from '../lib/useLang'
import { DEFAULT_RECIPE_SORT, parseRecipeSort } from '../lib/recipeSort'
import type {
	CatalogIngredient,
	CatalogTag,
	Course,
	Paginated,
	RecipeDifficulty,
	RecipeSummary,
	SortOrder,
	UserSearchResult,
	UserSortBy,
} from '../types/models'

const PAGE_SIZE = 12
const USERS_PAGE_SIZE = 6
// GET /users?search= rifiuta (400) ricerche più corte di 2 caratteri
const MIN_USER_SEARCH = 2
const COURSES: Course[] = ['appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack']
const DIFFICULTIES: RecipeDifficulty[] = ['easy', 'medium', 'hard']

// ordinamento degli utenti (sort_by: username | recipes_count | created_at)
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

// interruttore "tutti / almeno uno" per tag e ingredienti
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

// ricerca avanzata: filtri e ordinamento vivono nell'URL, così i risultati sono condivisibili e "indietro" funziona.
// Parametri URL → API GET /recipes:
//   q→search  course  difficulty  min_time  max_time  max_prep_time  curated→curated_only
//   tags→tag_ids  xtags→exclude_tag_ids  tag_mode
//   ings→ingredient_ids  xings→exclude_ingredient_ids  ing_mode→ingredient_mode
//   sort→sort_by+sort_order  page   (usort = ordinamento utenti)
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

	const [tags, setTags] = useState<CatalogTag[]>([])
	const [ingredients, setIngredients] = useState<CatalogIngredient[]>([])
	// risultato associato alla richiesta che lo ha prodotto: se la chiave non coincide con i filtri correnti si sta ancora caricando
	const [result, setResult] = useState<{
		key: string
		data: Paginated<RecipeSummary> | null
		users: Paginated<UserSearchResult> | null
		error: string | null
	} | null>(null)
	const [loadingMoreUsers, setLoadingMoreUsers] = useState(false)
	const [showFilters, setShowFilters] = useState(false)

	function update(patch: Record<string, string | null>, keepPage = false) {
		const next = new URLSearchParams(params)
		for (const [key, value] of Object.entries(patch)) {
			if (value) next.set(key, value)
			else next.delete(key)
		}
		if (!keepPage) next.delete('page')
		setParams(next)
	}

	// tag a tre stati: nessuno → incluso → escluso → nessuno (così include ed exclude non si sovrappongono mai)
	function cycleTag(id: number) {
		if (tagIds.includes(id)) {
			update({ tags: tagIds.filter((x) => x !== id).join(',') || null, xtags: [...excludeTagIds, id].join(',') })
		} else if (excludeTagIds.includes(id)) {
			update({ xtags: excludeTagIds.filter((x) => x !== id).join(',') || null })
		} else {
			update({ tags: [...tagIds, id].join(',') })
		}
	}

	useEffect(() => {
		api
			.get<CatalogTag[]>(`/tags${qs({ lang })}`)
			.then((res) => setTags(asArray<CatalogTag>(res)))
			.catch(() => setTags([]))
		api
			.get<CatalogIngredient[]>(`/ingredients${qs({ lang })}`)
			.then((res) => setIngredients(asArray<CatalogIngredient>(res)))
			.catch(() => setIngredients([]))
	}, [lang])

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

	useEffect(() => {
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
				// curated_only richiede lang (sempre presente)
				curated_only: curatedOnly ? 'true' : undefined,
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
		// utenti: GET /users (paginata) solo con almeno 2 caratteri e alla prima pagina; se fallisce si mostrano comunque le ricette
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
		t,
	])

	// "mostra altri utenti": pagina successiva di GET /users accodata alla lista
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
			// errore silenzioso: resta la lista già caricata
		} finally {
			setLoadingMoreUsers(false)
		}
	}

	const activeFilters =
		[course, difficulty, minTime, maxTime, maxPrepTime].filter(Boolean).length +
		(curatedOnly ? 1 : 0) +
		tagIds.length +
		excludeTagIds.length +
		ingredientIds.length +
		excludeIngredientIds.length
	const timeRangeInvalid = Boolean(minTime && maxTime && Number(minTime) > Number(maxTime))
	const current = result?.key === requestKey ? result : null
	const data = current?.data ?? null
	const users = current?.users?.items ?? []
	const usersPage = current?.users ?? null
	const error = current?.error ?? null
	const loading = current === null
	const hasResults = (data?.items.length ?? 0) > 0 || users.length > 0

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">
				{query ? t('search.resultsFor', { query }) : t('search.allRecipes')}
			</h1>

			<div className="mt-6 flex flex-wrap items-center justify-between gap-3">
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
								value={minTime}
								placeholder="10"
								onChange={(e) => update({ min_time: e.target.value || null })}
								className={`${SELECT} mt-1 w-full`}
							/>
						</label>
						<label className="text-xs text-[var(--wc-text-muted)]">
							{t('search.maxTime')}
							<input
								type="number"
								min={0}
								step={5}
								value={maxTime}
								placeholder="30"
								onChange={(e) => update({ max_time: e.target.value || null })}
								className={`${SELECT} mt-1 w-full`}
							/>
						</label>
						<label className="text-xs text-[var(--wc-text-muted)]">
							{t('search.maxPrepTime')}
							<input
								type="number"
								min={0}
								step={5}
								value={maxPrepTime}
								placeholder="15"
								onChange={(e) => update({ max_prep_time: e.target.value || null })}
								className={`${SELECT} mt-1 w-full`}
							/>
						</label>
					</div>
					{timeRangeInvalid && <p className="text-xs text-[var(--wc-paprika)]">{t('search.timeRangeInvalid')}</p>}

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
								{t('search.curatedOnlyHelp', { lang: t(`lang.${lang}`) })}
							</span>
						</span>
					</label>

					{tags.length > 0 && (
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
						</div>
					)}

					{ingredients.length > 0 && (
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
									catalog={ingredients}
									selectedIds={ingredientIds}
									disabledIds={excludeIngredientIds}
									onChange={(ids) => update({ ings: ids.join(',') || null })}
								/>
								<IngredientMultiPicker
									label={t('search.excludeIngredients')}
									tone="exclude"
									catalog={ingredients}
									selectedIds={excludeIngredientIds}
									disabledIds={ingredientIds}
									onChange={(ids) => update({ xings: ids.join(',') || null })}
								/>
							</div>
						</div>
					)}

					{activeFilters > 0 && (
						<button
							type="button"
							onClick={() =>
								update({
									course: null,
									difficulty: null,
									min_time: null,
									max_time: null,
									max_prep_time: null,
									curated: null,
									tags: null,
									xtags: null,
									tag_mode: null,
									ings: null,
									xings: null,
									ing_mode: null,
								})
							}
							className="text-sm text-[var(--wc-saffron)] hover:underline"
						>
							{t('search.clearFilters')}
						</button>
					)}
				</div>
			)}

			{error && <p className="mt-8 text-[var(--wc-paprika)]">{error}</p>}
			{loading && (
				<div className="mt-8">
					<RecipeGridSkeleton count={6} />
				</div>
			)}
			{!loading && !error && !hasResults && (
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
