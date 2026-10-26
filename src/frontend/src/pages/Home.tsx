import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import KitchenScene from '../3d/components/KitchenScene'

import { api, qs } from '../api/client'
import { useLang } from '../lib/useLang'
import RecipeCard from '../components/RecipeCard'
import { RecipeGridSkeleton } from '../components/Skeleton'
import type { Paginated, RecipeSummary } from '../types/models'

const FEED_SIZE = 8

function Home() {
	const { t } = useTranslation()
	const lang = useLang()
	const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	// feed: GET /api/recipes con page, limit, lang
	useEffect(() => {
		let cancelled = false
		api
			.get<Paginated<RecipeSummary>>(`/recipes${qs({ page: 1, limit: FEED_SIZE, lang })}`)
			.then((data) => {
				if (cancelled) return
				setRecipes(data?.items ?? [])
				setError(null)
			})
			.catch(() => {
				if (cancelled) return
				setRecipes([])
				setError(t('home.loadError'))
			})
		return () => {
			cancelled = true
		}
	}, [lang, t])

	return (
		<div>
			<section className="relative h-[70vh] w-full overflow-hidden">
				<KitchenScene />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--wc-bg)] to-transparent p-8">
					<h1 className="font-display text-4xl text-[var(--wc-text)] md:text-5xl">{t('home.heroTitle')}</h1>
					<p className="mt-2 max-w-md text-[var(--wc-text-muted)]">{t('home.heroText')}</p>
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-4 py-12">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{t('home.recent')}</h2>
					<Link to="/search" className="text-sm text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]">
						{t('home.seeAll')}
					</Link>
				</div>

				{error && <p className="text-[var(--wc-paprika)]">{error}</p>}

				{recipes === null ? (
					<RecipeGridSkeleton count={FEED_SIZE} />
				) : (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{recipes.map((r) => (
							<RecipeCard key={r.id} recipe={r} />
						))}
						{!error && recipes.length === 0 && <p className="text-[var(--wc-text-muted)]">{t('home.empty')}</p>}
					</div>
				)}
			</section>
		</div>
	)
}

export default Home
