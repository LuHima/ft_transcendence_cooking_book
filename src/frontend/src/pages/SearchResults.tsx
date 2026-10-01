import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import RecipeCard from '../components/RecipeCard'
import { api, ApiError } from '../api/client'
import type { Recipe } from '../types/models'

function SearchResults() {
	const [searchParams] = useSearchParams()
	const query = searchParams.get('q') ?? ''
	const [results, setResults] = useState<Recipe[]>([])
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)

	// senza query (es. da "Vedi tutte" in home) si elencano tutte le ricette
	useEffect(() => {
		let cancelled = false
		const path = query ? `/recipes/search?value=${encodeURIComponent(query)}` : '/recipes'

		api
			.get<Recipe[]>(path)
			.then((data) => {
				if (cancelled) return
				setResults(data)
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setResults([])
				setError(err instanceof ApiError ? err.message : 'Ricerca non riuscita.')
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})

		return () => {
			cancelled = true
			setLoading(true)
		}
	}, [query])

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">
				{query ? `Risultati per "${query}"` : 'Tutte le ricette'}
			</h1>

			{loading && <p className="mt-8 text-[var(--wc-text-muted)]">{query ? 'Ricerca in corso…' : 'Caricamento…'}</p>}
			{error && <p className="mt-8 text-[var(--wc-paprika)]">{error}</p>}
			{!loading && !error && results.length === 0 && (
				<p className="mt-8 text-[var(--wc-text-muted)]">
					{query ? `Nessuna ricetta trovata per "${query}".` : 'Nessuna ricetta pubblicata ancora.'}
				</p>
			)}

			<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{results.map((recipe) => (
					<RecipeCard key={recipe.id} recipe={recipe} />
				))}
			</div>
		</div>
	)
}

export default SearchResults
