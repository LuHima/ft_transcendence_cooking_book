import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage, qs, toPage } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import Pagination from '../../components/Pagination'
import { ListSkeleton } from '../../components/Skeleton'
import type { AdminComment, Paginated } from '../../types/models'

const PAGE_SIZE = 15

// NB: endpoint da esporre lato backend (guard: solo admin): GET /admin/comments?page=&limit=&search= -> Paginated<AdminComment>
// (con user e recipe incluse). L'eliminazione usa DELETE /recipes/:recipeId/comments/:id, che il backend
// deve consentire anche ad admin e moderatori (oggi solo autore del commento e autore della ricetta).
function AdminComments() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const [data, setData] = useState<Paginated<AdminComment> | null>(null)
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
			.get<unknown>(`/admin/comments${qs({ page, limit: PAGE_SIZE, search: debounced })}`)
			.then((res) => {
				if (cancelled) return
				setData(toPage<AdminComment>(res, PAGE_SIZE))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setData(toPage<AdminComment>([], PAGE_SIZE))
				setError(getErrorMessage(err, t('comments.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, debounced, reload, t])

	async function handleDelete(c: AdminComment) {
		if (!confirm(t('comments.confirmDelete'))) return
		setDeletingId(c.id)
		try {
			await api.delete(`/recipes/${c.recipe_id}/comments/${c.id}`)
			toast.success(t('comments.deleted'))
			if (data && data.items.length === 1 && page > 1) setPage(page - 1)
			else setReload((n) => n + 1)
		} catch (err) {
			toast.error(getErrorMessage(err, t('comments.deleteError')))
		} finally {
			setDeletingId(null)
		}
	}

	return (
		<div>
			<input
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				placeholder={t('admin.comments.filter')}
				aria-label={t('admin.comments.filter')}
				className="w-full max-w-xs rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
			/>
			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{!data && <div className="mt-4"><ListSkeleton /></div>}
			{data && data.items.length === 0 && !error && (
				<p className="mt-6 text-[var(--wc-text-muted)]">{t('admin.comments.empty')}</p>
			)}

			<ul className="mt-4 space-y-3">
				{data?.items.map((c) => (
					<li key={c.id} className="rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4">
						<div className="flex items-start justify-between gap-3 text-xs text-[var(--wc-text-muted)]">
							<span>
								<Link to={`/users/${c.user.id}`} className="font-semibold text-[var(--wc-text)] hover:text-[var(--wc-saffron)]">
									{c.user.username}
								</Link>{' '}
								{t('admin.comments.on')}{' '}
								<Link to={`/recipes/${c.recipe_id}`} className="hover:text-[var(--wc-saffron)] hover:underline">
									{c.recipe?.title ?? `#${c.recipe_id}`}
								</Link>{' '}
								· {new Date(c.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}
							</span>
							<button
								onClick={() => handleDelete(c)}
								disabled={deletingId === c.id}
								className="shrink-0 text-[var(--wc-paprika)] hover:underline disabled:opacity-50"
							>
								{t('common.remove')}
							</button>
						</div>
						<p className="mt-2 whitespace-pre-line break-words text-sm text-[var(--wc-text)]">{c.content}</p>
					</li>
				))}
			</ul>

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}
		</div>
	)
}

export default AdminComments
