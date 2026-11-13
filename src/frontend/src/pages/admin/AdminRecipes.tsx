import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, ApiError, getErrorMessage, qs } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import { canPurge, canRestoreRecipe } from '../../lib/permissions'
import { DEFAULT_RECIPE_SORT, parseRecipeSort, type RecipeSortValue } from '../../lib/recipeSort'
import { SUPPORTED_LANGS } from '../../i18n'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import PrivacyBadge from '../../components/PrivacyBadge'
import RecipeSortSelect from '../../components/RecipeSortSelect'
import { ListSkeleton } from '../../components/Skeleton'
import type { AdminRecipeStatus, Course, Paginated, RecipeDifficulty, RecipeSummary } from '../../types/models'

const PAGE_SIZE = 15
const STATUSES: AdminRecipeStatus[] = ['all', 'active', 'inactive']
const COURSES: Course[] = ['appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack']
const DIFFICULTIES: RecipeDifficulty[] = ['easy', 'medium', 'hard']

const SELECT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'

// elenco ricette per lo staff (admin e moderatori, anche dalla pagina /moderation):
//   GET    /admin/recipes?page=&limit=&lang=&search=&status=&course=&difficulty=&source_lang=&author_id=&sort_by=&sort_order=
//   DELETE /recipes/:id                       → sospensione (admin e moderatori; 403 sulle ricette degli admin per i moderatori)
//   PATCH  /recipes/:id { is_active: true }   → riattivazione (autore o admin)
//   DELETE /recipes/:id?hard=true             → eliminazione definitiva (solo admin)
function AdminRecipes() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const { user } = useAuth()
	const [data, setData] = useState<Paginated<RecipeSummary> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [status, setStatus] = useState<AdminRecipeStatus>('all')
	const [course, setCourse] = useState<Course | ''>('')
	const [difficulty, setDifficulty] = useState<RecipeDifficulty | ''>('')
	const [sourceLang, setSourceLang] = useState('')
	const [authorIdText, setAuthorIdText] = useState('')
	const [authorId, setAuthorId] = useState<number | undefined>()
	const [sort, setSort] = useState<RecipeSortValue>(DEFAULT_RECIPE_SORT)
	const [page, setPage] = useState(1)
	const [reload, setReload] = useState(0)
	const [busyId, setBusyId] = useState<number | null>(null)
	const [purging, setPurging] = useState<RecipeSummary | null>(null)
	const { sortBy, sortOrder } = parseRecipeSort(sort)

	// filtri testuali: partono 300ms dopo l'ultimo tasto
	useEffect(() => {
		const id = window.setTimeout(() => {
			setDebounced(search.trim())
			setAuthorId(/^\d+$/.test(authorIdText.trim()) && Number(authorIdText) > 0 ? Number(authorIdText) : undefined)
			setPage(1)
		}, 300)
		return () => window.clearTimeout(id)
	}, [search, authorIdText])

	useEffect(() => {
		let cancelled = false
		api
			.get<Paginated<RecipeSummary>>(
				`/admin/recipes${qs({
					page,
					limit: PAGE_SIZE,
					lang,
					search: debounced,
					status,
					course,
					difficulty,
					source_lang: sourceLang,
					author_id: authorId,
					sort_by: sortBy,
					sort_order: sortOrder,
				})}`,
			)
			.then((res) => {
				if (cancelled) return
				setData(res)
				setError(null)
			})
			.catch((err) => {
				if (!cancelled) setError(getErrorMessage(err, t('myRecipes.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, debounced, status, course, difficulty, sourceLang, authorId, sortBy, sortOrder, lang, reload, t])

	// cambia un filtro e riparte dalla prima pagina
	function changeFilter(fn: () => void) {
		fn()
		setPage(1)
	}

	// aggiorna la riga in locale; se il filtro di stato la esclude, ricarica la pagina
	function afterStatusChange(r: RecipeSummary, isActive: boolean) {
		if (status === 'all') {
			setData((prev) => (prev ? { ...prev, items: prev.items.map((x) => (x.id === r.id ? { ...x, is_active: isActive } : x)) } : prev))
		} else if (data && data.items.length === 1 && page > 1) {
			setPage(page - 1)
		} else {
			setReload((n) => n + 1)
		}
	}

	async function suspend(r: RecipeSummary) {
		if (!confirm(t('admin.recipes.confirmDelete', { title: r.title }))) return
		setBusyId(r.id)
		try {
			await api.delete(`/recipes/${r.id}`)
			toast.success(t('admin.recipes.suspended'))
			afterStatusChange(r, false)
		} catch (err) {
			// 403: un moderatore non può sospendere le ricette di un amministratore
			toast.error(
				err instanceof ApiError && err.status === 403 ? t('recipe.suspendForbidden') : getErrorMessage(err, t('recipe.deleteError')),
			)
		} finally {
			setBusyId(null)
		}
	}

	async function reactivate(r: RecipeSummary) {
		setBusyId(r.id)
		try {
			await api.patch(`/recipes/${r.id}`, { is_active: true })
			toast.success(t('recipe.reactivated'))
			afterStatusChange(r, true)
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.reactivateError')))
		} finally {
			setBusyId(null)
		}
	}

	async function purge(r: RecipeSummary) {
		try {
			await api.delete(`/recipes/${r.id}${qs({ hard: 'true' })}`)
			toast.success(t('recipe.purged'))
			setPurging(null)
			if (data && data.items.length === 1 && page > 1) setPage(page - 1)
			else setReload((n) => n + 1)
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.deleteError')))
			setPurging(null)
		}
	}

	const activeFilters = [course, difficulty, sourceLang, authorIdText.trim()].filter(Boolean).length

	return (
		<div>
			<div className="space-y-3 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3">
				<div className="flex flex-wrap items-center gap-3">
					<input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t('admin.recipes.filter')}
						aria-label={t('admin.recipes.filter')}
						className="w-full max-w-xs rounded-full border border-[var(--wc-border)] bg-[var(--wc-bg)] px-4 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
					/>
					<div role="radiogroup" aria-label={t('admin.users.status')} className="inline-flex overflow-hidden rounded-full border border-[var(--wc-border)] text-sm">
						{STATUSES.map((s) => (
							<button
								key={s}
								type="button"
								role="radio"
								aria-checked={status === s}
								onClick={() =>
									changeFilter(() => {
										setStatus(s)
										setData(null)
									})
								}
								className={`px-3 py-1.5 ${status === s ? 'bg-[var(--wc-basil)] text-[var(--wc-bg)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'}`}
							>
								{t(`admin.recipes.statuses.${s}`)}
							</button>
						))}
					</div>
					<div className="ml-auto">
						<RecipeSortSelect value={sort} onChange={(v) => changeFilter(() => setSort(v))} />
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<select value={course} aria-label={t('recipe.course')} onChange={(e) => changeFilter(() => setCourse(e.target.value as Course | ''))} className={SELECT}>
						<option value="">{t('recipe.course')}: {t('search.any')}</option>
						{COURSES.map((c) => (
							<option key={c} value={c}>
								{t(`course.${c}`)}
							</option>
						))}
					</select>
					<select
						value={difficulty}
						aria-label={t('recipe.difficulty')}
						onChange={(e) => changeFilter(() => setDifficulty(e.target.value as RecipeDifficulty | ''))}
						className={SELECT}
					>
						<option value="">{t('recipe.difficulty')}: {t('search.any')}</option>
						{DIFFICULTIES.map((d) => (
							<option key={d} value={d}>
								{t(`difficulty.${d}`)}
							</option>
						))}
					</select>
					<select value={sourceLang} aria-label={t('search.sourceLang')} onChange={(e) => changeFilter(() => setSourceLang(e.target.value))} className={SELECT}>
						<option value="">{t('search.sourceLang')}: {t('search.any')}</option>
						{SUPPORTED_LANGS.map((l) => (
							<option key={l} value={l}>
								{t(`lang.${l}`)}
							</option>
						))}
					</select>
					<input
						inputMode="numeric"
						value={authorIdText}
						onChange={(e) => setAuthorIdText(e.target.value.replace(/\D/g, ''))}
						placeholder={t('search.authorId')}
						aria-label={t('search.authorId')}
						className={`${SELECT} w-32`}
					/>
					{activeFilters > 0 && (
						<button
							type="button"
							onClick={() =>
								changeFilter(() => {
									setCourse('')
									setDifficulty('')
									setSourceLang('')
									setAuthorIdText('')
								})
							}
							className="text-sm text-[var(--wc-saffron)] hover:underline"
						>
							{t('search.clearFilters')}
						</button>
					)}
				</div>
			</div>

			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{!data && !error && (
				<div className="mt-4">
					<ListSkeleton />
				</div>
			)}
			{data && data.items.length === 0 && !error && <p className="mt-6 text-[var(--wc-text-muted)]">{t('admin.recipes.empty')}</p>}

			{data && data.items.length > 0 && (
				<div className="mt-4 divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
					{data.items.map((r) => {
						const inactive = r.is_active === false
						// modifica e riattivazione: autore o admin; eliminazione definitiva: solo admin
						const canManage = canRestoreRecipe(user, r.author?.id)
						return (
							<div key={r.id} className={`flex flex-wrap items-center justify-between gap-4 p-4 ${inactive ? 'bg-[var(--wc-surface)]' : ''}`}>
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<Link
											to={`/recipes/${r.id}`}
											className={`truncate font-display text-lg hover:text-[var(--wc-saffron)] ${inactive ? 'text-[var(--wc-text-muted)]' : ''}`}
										>
											{r.title}
										</Link>
										<PrivacyBadge privacy={r.privacy} showPublic />
										{inactive && (
											<span className="shrink-0 rounded-full border border-[var(--wc-paprika)] px-2 py-0.5 text-[10px] uppercase text-[var(--wc-paprika)]">
												{t('recipe.suspendedBadge')}
											</span>
										)}
									</div>
									<p className="text-xs text-[var(--wc-text-muted)]">
										{t('recipe.by')}{' '}
										{r.author ? (
											<Link to={`/users/${r.author.id}`} className="hover:text-[var(--wc-saffron)] hover:underline">
												{r.author.username}
											</Link>
										) : (
											'WeCook'
										)}{' '}
										· {t(`lang.${r.source_lang}`)} · {t(`course.${r.course}`)}
									</p>
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
									{canManage && (
										<Link
											to={`/my-recipes/${r.id}/edit`}
											className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 hover:border-[var(--wc-basil)]"
										>
											{t('common.edit')}
										</Link>
									)}
									{inactive
										? canManage && (
												<button
													onClick={() => void reactivate(r)}
													disabled={busyId === r.id}
													className="rounded-full bg-[var(--wc-basil)] px-3 py-1.5 font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-50"
												>
													{t('admin.recipes.reactivate')}
												</button>
											)
										: (
												<button
													onClick={() => void suspend(r)}
													disabled={busyId === r.id}
													className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-50"
												>
													{t('admin.recipes.suspend')}
												</button>
											)}
									{canPurge(user) && (
										<button
											onClick={() => setPurging(r)}
											disabled={busyId === r.id}
											className="rounded-full border border-[var(--wc-paprika)] px-3 py-1.5 font-medium text-[var(--wc-paprika)] hover:bg-[var(--wc-paprika)] hover:text-[var(--wc-bg)] disabled:opacity-50"
										>
											{t('recipe.purge')}
										</button>
									)}
								</div>
							</div>
						)
					})}
				</div>
			)}

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}

			{purging && (
				<ConfirmDialog
					title={t('recipe.purgeTitle')}
					confirmLabel={t('recipe.purge')}
					danger
					onConfirm={() => purge(purging)}
					onClose={() => setPurging(null)}
				>
					<p>{t('recipe.purgeText', { title: purging.title })}</p>
				</ConfirmDialog>
			)}
		</div>
	)
}

export default AdminRecipes
