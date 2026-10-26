import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage, qs } from '../api/client'
import { useLang } from '../lib/useLang'
import Pagination from '../components/Pagination'
import RecipeCard from '../components/RecipeCard'
import { RecipeGridSkeleton } from '../components/Skeleton'
import type { Paginated, RecipeSummary } from '../types/models'

const PAGE_SIZE = 12

function Favorites() {
	const { t } = useTranslation()
	const lang = useLang()
	const [page, setPage] = useState(1)
	const [data, setData] = useState<Paginated<RecipeSummary> | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		api
			.get<Paginated<RecipeSummary>>(`/users/me/likes${qs({ page, limit: PAGE_SIZE, lang })}`)
			.then((res) => {
				if (cancelled) return
				setData(res)
				setError(null)
			})
			.catch((err) => {
				if (!cancelled) setError(getErrorMessage(err, t('favorites.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, lang, t])

	return (
		<div className="mx-auto max-w-7xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('favorites.title')}</h1>

			{error && <p className="mt-6 text-[var(--wc-paprika)]">{error}</p>}

			{!data && !error && (
				<div className="mt-8">
					<RecipeGridSkeleton count={6} />
				</div>
			)}

			{!error && data && data.items.length === 0 && (
				<p className="mt-6 text-[var(--wc-text-muted)]">{t('favorites.empty')}</p>
			)}

			<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{data?.items.map((recipe) => (
					<RecipeCard key={recipe.id} recipe={recipe} />
				))}
			</div>

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}
		</div>
	)
}

export default Favorites
