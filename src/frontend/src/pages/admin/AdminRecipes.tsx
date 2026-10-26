import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage, qs } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import Pagination from '../../components/Pagination'
import { ListSkeleton } from '../../components/Skeleton'
import type { Paginated, RecipeSummary } from '../../types/models'

const PAGE_SIZE = 15

// elenco ricette per l'admin: usa GET /recipes (già pronta) con ricerca e paginazione.
// L'eliminazione usa DELETE /recipes/:id, che il backend consente a proprietario e admin.
function AdminRecipes() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const [data, setData] = useState<Paginated<RecipeSummary> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [page, setPage] = useState(1)
	const [reload, setReload] = useState(0)
	const [deletingId, setDeletingId] = useState<number | null>(null)

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
			.get<Paginated<RecipeSummary>>(`/recipes${qs({ page, limit: PAGE_SIZE, lang, search: debounced })}`)
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
	}, [page, debounced, lang, reload, t])

	async function handleDelete(r: RecipeSummary) {
		if (!confirm(t('admin.recipes.confirmDelete', { title: r.title }))) return
		setDeletingId(r.id)
		try {
			await api.delete(`/recipes/${r.id}`)
			toast.success(t('recipe.deleted'))
			if (data && data.items.length === 1 && page > 1) setPage(page - 1)
			else setReload((n) => n + 1)
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.deleteError')))
		} finally {
			setDeletingId(null)
		}
	}

	return (
		<div>
			<input
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				placeholder={t('admin.recipes.filter')}
				aria-label={t('admin.recipes.filter')}
				className="w-full max-w-xs rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
			/>
			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{!data && !error && <div className="mt-4"><ListSkeleton /></div>}
			{data && data.items.length === 0 && !error && (
				<p className="mt-6 text-[var(--wc-text-muted)]">{t('admin.recipes.empty')}</p>
			)}

			{data && data.items.length > 0 && (
				<div className="mt-4 divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
					{data.items.map((r) => (
						<div key={r.id} className="flex items-center justify-between gap-4 p-4">
							<div className="min-w-0">
								<Link to={`/recipes/${r.id}`} className="block truncate font-display text-lg hover:text-[var(--wc-saffron)]">
									{r.title}
								</Link>
								<p className="text-xs text-[var(--wc-text-muted)]">
									{t('recipe.by')} {r.author ? r.author.username : 'WeCook'}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-2 text-sm">
								<Link
									to={`/my-recipes/${r.id}/edit`}
									className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 hover:border-[var(--wc-basil)]"
								>
									{t('common.edit')}
								</Link>
								<button
									onClick={() => handleDelete(r)}
									disabled={deletingId === r.id}
									className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-50"
								>
									{t('common.remove')}
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}
		</div>
	)
}

export default AdminRecipes
