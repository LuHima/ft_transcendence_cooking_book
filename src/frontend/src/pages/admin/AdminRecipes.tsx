import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage, qs } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import Pagination from '../../components/Pagination'
import ConfirmDialog from '../../components/ConfirmDialog'
import { ListSkeleton } from '../../components/Skeleton'
import type { AdminRecipeStatus, Paginated, RecipeSummary } from '../../types/models'

const PAGE_SIZE = 15
const STATUSES: AdminRecipeStatus[] = ['all', 'active', 'inactive']

// elenco ricette per lo staff:
//   GET    /admin/recipes?page=&limit=&lang=&search=&status=all|active|inactive  (stessi filtri di GET /recipes)
//   PATCH  /recipes/:id { is_active: true }   → riattiva una ricetta sospesa
//   DELETE /recipes/:id                       → sospensione (soft delete)
//   DELETE /recipes/:id?hard=true             → eliminazione definitiva (solo admin, con conferma)
function AdminRecipes() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const [data, setData] = useState<Paginated<RecipeSummary> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [status, setStatus] = useState<AdminRecipeStatus>('all')
	const [page, setPage] = useState(1)
	const [reload, setReload] = useState(0)
	const [busyId, setBusyId] = useState<number | null>(null)
	const [purging, setPurging] = useState<RecipeSummary | null>(null)

	useEffect(() => {
		const id = window.setTimeout(() => {
			setDebounced(search.trim())
			setPage(1)
		}, 300)
		return () => window.clearTimeout(id)
	}, [search])

	useEffect(() => {
		let cancelled = false
		api
			.get<Paginated<RecipeSummary>>(`/admin/recipes${qs({ page, limit: PAGE_SIZE, lang, search: debounced, status })}`)
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
	}, [page, debounced, status, lang, reload, t])

	// aggiorna la riga in locale; se il filtro attivo la esclude, ricarica la pagina
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
			toast.error(getErrorMessage(err, t('recipe.deleteError')))
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

	return (
		<div>
			<div className="flex flex-wrap items-center gap-3">
				<input
					type="search"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={t('admin.recipes.filter')}
					aria-label={t('admin.recipes.filter')}
					className="w-full max-w-xs rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
				/>
				<div role="radiogroup" aria-label={t('admin.users.status')} className="inline-flex overflow-hidden rounded-full border border-[var(--wc-border)] text-sm">
					{STATUSES.map((s) => (
						<button
							key={s}
							type="button"
							role="radio"
							aria-checked={status === s}
							onClick={() => {
								setStatus(s)
								setPage(1)
								setData(null)
							}}
							className={`px-3 py-1.5 ${status === s ? 'bg-[var(--wc-basil)] text-[var(--wc-bg)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'}`}
						>
							{t(`admin.recipes.statuses.${s}`)}
						</button>
					))}
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
						return (
							<div key={r.id} className={`flex flex-wrap items-center justify-between gap-4 p-4 ${inactive ? 'bg-[var(--wc-surface)]' : ''}`}>
								<div className="min-w-0">
									<div className="flex items-center gap-2">
										<Link
											to={`/recipes/${r.id}`}
											className={`truncate font-display text-lg hover:text-[var(--wc-saffron)] ${inactive ? 'text-[var(--wc-text-muted)]' : ''}`}
										>
											{r.title}
										</Link>
										{inactive && (
											<span className="shrink-0 rounded-full border border-[var(--wc-paprika)] px-2 py-0.5 text-[10px] uppercase text-[var(--wc-paprika)]">
												{t('recipe.suspendedBadge')}
											</span>
										)}
									</div>
									<p className="text-xs text-[var(--wc-text-muted)]">
										{t('recipe.by')} {r.author ? r.author.username : 'WeCook'}
									</p>
								</div>
								<div className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
									<Link
										to={`/my-recipes/${r.id}/edit`}
										className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 hover:border-[var(--wc-basil)]"
									>
										{t('common.edit')}
									</Link>
									{inactive ? (
										<button
											onClick={() => void reactivate(r)}
											disabled={busyId === r.id}
											className="rounded-full bg-[var(--wc-basil)] px-3 py-1.5 font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-50"
										>
											{t('admin.recipes.reactivate')}
										</button>
									) : (
										<button
											onClick={() => void suspend(r)}
											disabled={busyId === r.id}
											className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-50"
										>
											{t('admin.recipes.suspend')}
										</button>
									)}
									<button
										onClick={() => setPurging(r)}
										disabled={busyId === r.id}
										className="rounded-full border border-[var(--wc-paprika)] px-3 py-1.5 font-medium text-[var(--wc-paprika)] hover:bg-[var(--wc-paprika)] hover:text-[var(--wc-bg)] disabled:opacity-50"
									>
										{t('recipe.purge')}
									</button>
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
