import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, ApiError, getErrorMessage, qs } from '../../api/client'
import { useAuth } from '../../context/auth'
import { useToast } from '../../context/toast'
import { useLang } from '../../lib/useLang'
import { canEditRecipe, canPurge, canRestoreRecipe } from '../../lib/permissions'
import { reportsHref, useStaffBasePath } from '../../lib/staffLinks'
import { useScrollIntoViewOnChange } from '../../lib/useScrollIntoViewOnChange'
import { DEFAULT_RECIPE_SORT, RECIPE_SORT_OPTIONS } from '../../lib/recipeSort'
import { SUPPORTED_LANGS } from '../../i18n'
import BanHistoryDrawer from '../../components/BanHistoryDrawer'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import PrivacyBadge from '../../components/PrivacyBadge'
import { ListSkeleton } from '../../components/Skeleton'
import type { AdminRecipe, AdminRecipeSortBy, AdminRecipeStatus, Course, Paginated, RecipeDifficulty, SortOrder } from '../../types/models'

const PAGE_SIZE = 15
const STATUSES: AdminRecipeStatus[] = ['all', 'active', 'inactive']
const COURSES: Course[] = ['appetizer', 'first_course', 'main_course', 'dessert', 'side_dish', 'drink', 'snack']
const DIFFICULTIES: RecipeDifficulty[] = ['easy', 'medium', 'hard']

// ordinamenti delle ricette + contatori di segnalazioni (AdminRecipeSortBy); label = chiave i18n
const SORT_OPTIONS = [
	...RECIPE_SORT_OPTIONS.map((o) => ({ value: o.value as string, label: `search.sort.${o.label}` })),
	{ value: 'pending_reports_count:desc', label: 'admin.recipes.sort.mostPending' },
	{ value: 'reports_count:desc', label: 'admin.recipes.sort.mostReports' },
]
// default del backend con reported_only=true (se sort_by non viene inviato)
const REPORTED_DEFAULT_SORT = 'pending_reports_count:desc'

const SELECT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'

// elenco ricette per lo staff (admin e moderatori, anche dalla pagina /moderation):
//   GET    /admin/recipes?page=&limit=&lang=&search=&status=&course=&difficulty=&source_lang=&author_id=&reported_only=&sort_by=&sort_order=
//          (per riga: reports_count, pending_reports_count, has_pending_reports, latest_pending_report_id;
//           sort_by anche pending_reports_count / reports_count, predefinito con reported_only=true)
//   DELETE /recipes/:id                       → sospensione (admin e moderatori; 403 sulle ricette degli admin per i moderatori)
//   PATCH  /recipes/:id { is_active: true }   → riattivazione (staff: admin o moderatore)
//   DELETE /recipes/:id?hard=true             → eliminazione definitiva (solo admin)
function AdminRecipes() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const { user } = useAuth()
	const base = useStaffBasePath()
	const [data, setData] = useState<Paginated<AdminRecipe> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [status, setStatus] = useState<AdminRecipeStatus>('all')
	const [course, setCourse] = useState<Course | ''>('')
	const [difficulty, setDifficulty] = useState<RecipeDifficulty | ''>('')
	const [sourceLang, setSourceLang] = useState('')
	const [authorIdText, setAuthorIdText] = useState('')
	const [authorId, setAuthorId] = useState<number | undefined>()
	// null = ordinamento predefinito del backend (created_at desc, oppure pending_reports_count desc con "solo segnalate")
	const [sort, setSort] = useState<string | null>(null)
	// solo ricette con segnalazioni in attesa
	const [reportedOnly, setReportedOnly] = useState(false)
	const [page, setPage] = useState(1)
	const [reload, setReload] = useState(0)
	const [busyId, setBusyId] = useState<number | null>(null)
	const [purging, setPurging] = useState<AdminRecipe | null>(null)
	const [suspending, setSuspending] = useState<AdminRecipe | null>(null)
	const [history, setHistory] = useState<{ id: number; username: string } | null>(null)
	const shownSort = sort ?? (reportedOnly ? REPORTED_DEFAULT_SORT : DEFAULT_RECIPE_SORT)
	const [sortBy, sortOrder] = sort ? (sort.split(':') as [AdminRecipeSortBy, SortOrder]) : [undefined, undefined]
	const listTopRef = useRef<HTMLDivElement>(null)
	useScrollIntoViewOnChange(page, listTopRef)

	// filtri testuali: partono 300ms dopo l'ultimo tasto
	useEffect(() => {
		const id = window.setTimeout(() => {
			setDebounced(search.trim())
			setAuthorId(/^\d+$/.test(authorIdText.trim()) && Number(authorIdText) > 0 ? Number(authorIdText) : undefined)
			setPage(1)
		}, 300)
		return () => window.clearTimeout(id)
	}, [search, authorIdText])

	// filtri cambiati: via le righe vecchie (skeleton) invece di mostrare risultati non più validi
	const filterKey = [debounced, status, course, difficulty, sourceLang, authorId, sort, reportedOnly].join('|')
	const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
	if (filterKey !== prevFilterKey) {
		setPrevFilterKey(filterKey)
		setData(null)
	}

	useEffect(() => {
		let cancelled = false
		api
			.get<Paginated<AdminRecipe>>(
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
					reported_only: reportedOnly ? 'true' : undefined,
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
				if (cancelled) return
				setData(null)
				setError(getErrorMessage(err, t('myRecipes.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, debounced, status, course, difficulty, sourceLang, authorId, reportedOnly, sortBy, sortOrder, lang, reload, t])

	// cambia un filtro e riparte dalla prima pagina
	function changeFilter(fn: () => void) {
		fn()
		setPage(1)
	}

	// aggiorna la riga in locale; se il filtro di stato la esclude, ricarica la pagina
	function afterStatusChange(r: AdminRecipe, isActive: boolean) {
		if (status === 'all') {
			setData((prev) => (prev ? { ...prev, items: prev.items.map((x) => (x.id === r.id ? { ...x, is_active: isActive } : x)) } : prev))
		} else if (data && data.items.length === 1 && page > 1) {
			setPage(page - 1)
		} else {
			setReload((n) => n + 1)
		}
	}

	async function suspend(r: AdminRecipe) {
		setSuspending(null)
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

	async function reactivate(r: AdminRecipe) {
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

	async function purge(r: AdminRecipe) {
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
		<div ref={listTopRef} className="scroll-mt-24">
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
								onClick={() => changeFilter(() => setStatus(s))}
								className={`px-3 py-1.5 ${status === s ? 'bg-[var(--wc-basil)] text-[var(--wc-bg)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'}`}
							>
								{t(`admin.recipes.statuses.${s}`)}
							</button>
						))}
					</div>
					<label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--wc-text)]">
						<input type="checkbox" checked={reportedOnly} onChange={(e) => changeFilter(() => setReportedOnly(e.target.checked))} />
						{t('admin.comments.reportedOnly')}
					</label>
					<div className="ml-auto">
						<label className="flex items-center gap-2 text-sm text-[var(--wc-text-muted)]">
							{t('search.sortBy')}
							<select value={shownSort} onChange={(e) => changeFilter(() => setSort(e.target.value))} className={SELECT}>
								{SORT_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{t(o.label)}
									</option>
								))}
							</select>
						</label>
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
						// modifica: autore o admin; riattivazione: staff; eliminazione definitiva: solo admin
						const canEdit = canEditRecipe(user, r.author?.id)
						const canReactivate = canRestoreRecipe(user)
						const totalReports = r.reports_count ?? 0
						const pendingReports = r.pending_reports_count ?? 0
						const hasReports = Boolean(r.has_pending_reports) || totalReports > 0
						return (
							<div
								key={r.id}
								className={`flex flex-wrap items-center justify-between gap-4 p-4 ${inactive ? 'bg-[var(--wc-surface)]' : ''} ${
									r.has_pending_reports ? 'border-l-4 border-l-[var(--wc-paprika)]' : ''
								}`}
							>
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
										{/* segnalazioni: in attesa in evidenza, altrimenti il totale storico */}
										{r.has_pending_reports && (
											<span className="shrink-0 rounded-full bg-[var(--wc-paprika)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wc-bg)]">
												⚑ {t('admin.comments.reported')}
												{pendingReports > 0 && ` (${pendingReports})`}
											</span>
										)}
										{!r.has_pending_reports && totalReports > 0 && (
											<span className="shrink-0 rounded-full border border-[var(--wc-border)] px-2 py-0.5 text-[10px]" title={t('admin.comments.totalReports')}>
												⚑ {totalReports}
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
									{/* in un clic: dialogo di risoluzione dell'ultima segnalazione in attesa */}
									{r.latest_pending_report_id != null && (
										<Link
											to={reportsHref(base, { report_id: r.latest_pending_report_id, resolve: true })}
											className="rounded-full bg-[var(--wc-paprika)] px-3 py-1.5 font-medium text-[var(--wc-bg)] hover:opacity-90"
										>
											{t('admin.reportsLink.resolve')}
										</Link>
									)}
									{hasReports && (
										<Link
											to={reportsHref(base, { subject: 'recipe', target_id: r.id, status: 'all' })}
											className="rounded-full border border-[var(--wc-paprika)] px-3 py-1.5 text-[var(--wc-paprika)] hover:bg-[var(--wc-paprika)] hover:text-[var(--wc-bg)]"
										>
											{t('admin.reportsLink.view', { count: totalReports })}
										</Link>
									)}
									{r.author && (
										<button
											type="button"
											onClick={() => r.author && setHistory({ id: r.author.id, username: r.author.username })}
											className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 hover:border-[var(--wc-saffron)]"
										>
											{t('admin.users.banHistory')}
										</button>
									)}
									{canEdit && (
										<Link
											to={`/my-recipes/${r.id}/edit`}
											className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 hover:border-[var(--wc-basil)]"
										>
											{t('common.edit')}
										</Link>
									)}
									{inactive
										? canReactivate && (
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
													onClick={() => setSuspending(r)}
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

			{suspending && (
				<ConfirmDialog
					title={t('admin.recipes.suspend')}
					confirmLabel={t('admin.recipes.suspend')}
					danger
					onConfirm={() => suspend(suspending)}
					onClose={() => setSuspending(null)}
				>
					<p>{t('admin.recipes.confirmDelete', { title: suspending.title })}</p>
				</ConfirmDialog>
			)}
			{history && <BanHistoryDrawer user={history} onClose={() => setHistory(null)} />}

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
