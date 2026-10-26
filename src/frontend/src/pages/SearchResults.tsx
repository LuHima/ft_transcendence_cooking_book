import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import RecipeCard from '../components/RecipeCard'
import Avatar from '../components/Avatar'
import Pagination from '../components/Pagination'
import { RecipeGridSkeleton } from '../components/Skeleton'
import { api, asArray, getErrorMessage, qs } from '../api/client'
import { useLang } from '../lib/useLang'
import type {
	CatalogTag,
	Course,
	Paginated,
	RecipeDifficulty,
	RecipeSummary,
	UserSearchResult,
} from '../types/models'

const PAGE_SIZE = 12
const COURSES: Course[] = ['appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack']
const DIFFICULTIES: RecipeDifficulty[] = ['easy', 'medium', 'hard']

const SELECT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'

// ricerca avanzata: tutti i filtri vivono nell'URL (?q=&course=&difficulty=&tags=1,2&max_time=&page=),
// così i risultati sono condivisibili e il tasto "indietro" funziona
function SearchResults() {
	const { t } = useTranslation()
	const lang = useLang()
	const [params, setParams] = useSearchParams()

	const query = params.get('q') ?? ''
	const course = params.get('course') ?? ''
	const difficulty = params.get('difficulty') ?? ''
	const maxTime = params.get('max_time') ?? ''
	const tagIds = (params.get('tags') ?? '').split(',').filter(Boolean).map(Number).filter(Number.isInteger)
	const page = Math.max(1, Number(params.get('page')) || 1)

	const [tags, setTags] = useState<CatalogTag[]>([])
	// risultato associato alla richiesta che lo ha prodotto: se la chiave non coincide con i filtri correnti si sta ancora caricando
	const [result, setResult] = useState<{
		key: string
		data: Paginated<RecipeSummary> | null
		users: UserSearchResult[]
		error: string | null
	} | null>(null)
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

	function toggleTag(id: number) {
		const next = tagIds.includes(id) ? tagIds.filter((x) => x !== id) : [...tagIds, id]
		update({ tags: next.join(',') || null })
	}

	useEffect(() => {
		api
			.get<CatalogTag[]>(`/tags${qs({ lang })}`)
			.then((res) => setTags(asArray<CatalogTag>(res)))
			.catch(() => setTags([]))
	}, [lang])

	const tagKey = tagIds.join(',')
	const requestKey = [query, course, difficulty, maxTime, tagKey, page, lang].join('|')
	useEffect(() => {
		let cancelled = false

		const recipesRequest = api.get<Paginated<RecipeSummary>>(
			`/recipes${qs({
				page,
				limit: PAGE_SIZE,
				lang,
				search: query.trim(),
				course,
				difficulty,
				max_time: maxTime,
				tag_ids: tagKey,
			})}`,
		)
		// gli utenti si cercano solo con una query (e solo alla prima pagina); se la chiamata fallisce si mostrano comunque le ricette
		const usersRequest =
			query.trim() && page === 1
				? api.get<UserSearchResult[]>(`/users${qs({ search: query.trim() })}`).catch(() => [] as UserSearchResult[])
				: Promise.resolve([] as UserSearchResult[])

		Promise.all([recipesRequest, usersRequest])
			.then(([recipes, foundUsers]) => {
				if (cancelled) return
				setResult({ key: requestKey, data: recipes, users: asArray<UserSearchResult>(foundUsers), error: null })
			})
			.catch((err) => {
				if (cancelled) return
				setResult({ key: requestKey, data: null, users: [], error: getErrorMessage(err, t('search.error')) })
			})

		return () => {
			cancelled = true
		}
	}, [query, course, difficulty, maxTime, tagKey, page, lang, requestKey, t])

	const activeFilters = [course, difficulty, maxTime].filter(Boolean).length + tagIds.length
	const current = result?.key === requestKey ? result : null
	const data = current?.data ?? null
	const users = current?.users ?? []
	const error = current?.error ?? null
	const loading = current === null
	const hasResults = (data?.items.length ?? 0) > 0 || users.length > 0

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">
				{query ? t('search.resultsFor', { query }) : t('search.allRecipes')}
			</h1>

			<div className="mt-6">
				<button
					type="button"
					onClick={() => setShowFilters((v) => !v)}
					aria-expanded={showFilters}
					className="rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm text-[var(--wc-text)] hover:border-[var(--wc-basil)]"
				>
					{t('search.filters')}
					{activeFilters > 0 && ` (${activeFilters})`}
				</button>

				{showFilters && (
					<div className="mt-3 space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4">
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
						</div>

						{tags.length > 0 && (
							<div>
								<p className="mb-2 text-xs text-[var(--wc-text-muted)]">{t('form.tags')}</p>
								<ul className="flex flex-wrap gap-2">
									{tags.map((tag) => {
										const active = tagIds.includes(tag.id)
										return (
											<li key={tag.id}>
												<button
													type="button"
													aria-pressed={active}
													onClick={() => toggleTag(tag.id)}
													className={`rounded-full border px-3 py-1 text-sm transition-colors ${
														active
															? 'border-[var(--wc-basil)] bg-[var(--wc-basil)] text-[var(--wc-bg)]'
															: 'border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-basil)]'
													}`}
												>
													{tag.name}
												</button>
											</li>
										)
									})}
								</ul>
							</div>
						)}

						{activeFilters > 0 && (
							<button
								type="button"
								onClick={() => update({ course: null, difficulty: null, max_time: null, tags: null })}
								className="text-sm text-[var(--wc-saffron)] hover:underline"
							>
								{t('search.clearFilters')}
							</button>
						)}
					</div>
				)}
			</div>

			{error && <p className="mt-8 text-[var(--wc-paprika)]">{error}</p>}
			{loading && (
				<div className="mt-8">
					<RecipeGridSkeleton count={6} />
				</div>
			)}
			{!loading && !error && !hasResults && (
				<p className="mt-8 text-[var(--wc-text-muted)]">
					{query || activeFilters > 0 ? t('search.noResults') : t('home.empty')}
				</p>
			)}

			{users.length > 0 && (
				<section className="mt-8">
					<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('search.users')}</h2>
					<ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{users.map((u) => {
							const content = (
								<>
									<Avatar username={u.username} url={u.avatar_url} className="h-10 w-10 text-base" />
									<span className="truncate font-medium text-[var(--wc-text)]">{u.username}</span>
								</>
							)
							const cls =
								'flex items-center gap-3 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3 transition-colors'
							return (
								<li key={u.id ?? u.username}>
									{/* NB: GET /users?search= per ora restituisce solo { username }: senza id il profilo non è raggiungibile */}
									{u.id != null ? (
										<Link to={`/users/${u.id}`} className={`${cls} hover:border-[var(--wc-basil)]`}>
											{content}
										</Link>
									) : (
										<div className={cls}>{content}</div>
									)}
								</li>
							)
						})}
					</ul>
				</section>
			)}

			{data && data.items.length > 0 && (
				<>
					{users.length > 0 && (
						<h2 className="mt-8 font-display text-xl text-[var(--wc-saffron)]">{t('search.recipes')}</h2>
					)}
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
