import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import SearchBar from '../components/SearchBar'
import RecipeCard from '../components/RecipeCard'
import { api, ApiError } from '../api/client'
import type { Recipe } from '../types/models'

function SearchResults() {
	const [searchParams] = useSearchParams()
	const query = searchParams.get('q') ?? ''
	const [results, setResults] = useState<Recipe[]>([])
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (!query) {
			setResults([])
			return
		}
		setLoading(true)
		setError(null)
		api
			.get<Recipe[]>(`/recipes/search?value=${encodeURIComponent(query)}`)
			.then(setResults)
			.catch((err) => setError(err instanceof ApiError ? err.message : 'Ricerca non riuscita.'))
			.finally(() => setLoading(false))
	}, [query])

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">
				{query ? `Risultati per "${query}"` : 'Cerca una ricetta'}
			</h1>

			<div className="mt-6 max-w-md">
				<SearchBar />
			</div>

			{loading && <p className="mt-8 text-[var(--wc-text-muted)]">Ricerca in corso…</p>}
			{error && <p className="mt-8 text-[var(--wc-paprika)]">{error}</p>}
			{!loading && !error && query && results.length === 0 && (
				<p className="mt-8 text-[var(--wc-text-muted)]">Nessuna ricetta trovata per "{query}".</p>
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
