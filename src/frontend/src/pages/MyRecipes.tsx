import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, assetUrl, getErrorMessage, qs } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useLang } from '../lib/useLang'
import Pagination from '../components/Pagination'
import { ListSkeleton } from '../components/Skeleton'
import type { Paginated, RecipeSummary } from '../types/models'

const PAGE_SIZE = 10

function MyRecipes() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const [page, setPage] = useState(1)
	const [data, setData] = useState<Paginated<RecipeSummary> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [deletingId, setDeletingId] = useState<number | null>(null)
	const [reload, setReload] = useState(0)

	useEffect(() => {
		let cancelled = false
		api
			.get<Paginated<RecipeSummary>>(`/users/me/recipes${qs({ page, limit: PAGE_SIZE, lang })}`)
			.then((res) => {
				if (cancelled) return
				setData(res)
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setError(getErrorMessage(err, t('myRecipes.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, lang, reload, t])

	async function handleDelete(id: number) {
		if (!confirm(t('recipe.confirmDelete'))) return
		setDeletingId(id)
		try {
			await api.delete(`/recipes/${id}`)
			toast.success(t('recipe.deleted'))
			// se si svuota l'ultima pagina si torna indietro
			if (data && data.items.length === 1 && page > 1) setPage(page - 1)
			else setReload((n) => n + 1)
		} catch (err) {
			toast.error(getErrorMessage(err, t('recipe.deleteError')))
		} finally {
			setDeletingId(null)
		}
	}

	return (
		<div className="mx-auto max-w-5xl px-4 py-12">
			<div className="mb-6 flex items-center justify-between gap-4">
				<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('myRecipes.title')}</h1>
				<Link
					to="/my-recipes/new"
					className="rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
				>
					+ {t('myRecipes.new')}
				</Link>
			</div>

			{error && <p className="mb-4 text-[var(--wc-paprika)]">{error}</p>}

			{!data && !error && <ListSkeleton />}

			{data && data.items.length === 0 && !error && (
				<p className="text-[var(--wc-text-muted)]">{t('myRecipes.empty')}</p>
			)}

			{data && data.items.length > 0 && (
				<div className="divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
					{data.items.map((recipe) => {
						const cover = assetUrl(recipe.cover_image_url)
						return (
							<div key={recipe.id} className="flex items-center justify-between gap-4 p-4">
								<div className="flex min-w-0 items-center gap-3">
									{cover ? (
										<img src={cover} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
									) : (
										<div className="h-12 w-12 shrink-0 rounded-lg bg-[var(--wc-surface-raised)]" />
									)}
									<div className="min-w-0">
										<Link
											to={`/recipes/${recipe.id}`}
											className="block truncate font-display text-lg hover:text-[var(--wc-saffron)]"
										>
											{recipe.title}
										</Link>
										<p className="text-xs text-[var(--wc-text-muted)]">
											{t(`difficulty.${recipe.difficulty}`)} · {t('recipe.minutes', { count: recipe.total_time })} · ♥{' '}
											{recipe.likes_count}
										</p>
									</div>
								</div>
								<div className="flex shrink-0 items-center gap-2 text-sm">
									<Link
										to={`/my-recipes/${recipe.id}/edit`}
										className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 hover:border-[var(--wc-basil)]"
									>
										{t('common.edit')}
									</Link>
									<button
										onClick={() => handleDelete(recipe.id)}
										disabled={deletingId === recipe.id}
										className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-50"
									>
										{t('common.delete')}
									</button>
								</div>
							</div>
						)
					})}
				</div>
			)}

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}
		</div>
	)
}

export default MyRecipes
