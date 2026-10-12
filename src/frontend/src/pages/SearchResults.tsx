import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import RecipeCard from '../components/RecipeCard'
import Avatar from '../components/Avatar'
import { api, ApiError, asArray } from '../api/client'
import type { Recipe, UserSummary } from '../types/models'

function SearchResults() {
	const [searchParams] = useSearchParams()
	const query = searchParams.get('q') ?? ''
	const [results, setResults] = useState<Recipe[]>([])
	const [users, setUsers] = useState<UserSummary[]>([])
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)

	// senza query (es. da "Vedi tutte" in home) si elencano tutte le ricette
	useEffect(() => {
		let cancelled = false
		const path = query ? `/recipes/search?value=${encodeURIComponent(query)}` : '/recipes'

		// gli utenti si cercano solo con una query; se quella chiamata fallisce si mostrano comunque le ricette
		const usersRequest = query
			? api.get<UserSummary[]>(`/users/search?value=${encodeURIComponent(query)}`).catch(() => [] as UserSummary[])
			: Promise.resolve([] as UserSummary[])

		Promise.all([api.get<Recipe[]>(path), usersRequest])
			.then(([data, foundUsers]) => {
				if (cancelled) return
				setResults(asArray<Recipe>(data))
				setUsers(asArray<UserSummary>(foundUsers))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setResults([])
				setUsers([])
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
			{!loading && !error && results.length === 0 && users.length === 0 && (
				<p className="mt-8 text-[var(--wc-text-muted)]">
					{query ? `Nessun risultato per "${query}".` : 'Nessuna ricetta pubblicata ancora.'}
				</p>
			)}

			{users.length > 0 && (
				<section className="mt-8">
					<h2 className="font-display text-xl text-[var(--wc-saffron)]">Utenti</h2>
					<ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{users.map((u) => (
							<li key={u.id}>
								<Link
									to={`/users/${u.id}`}
									className="flex items-center gap-3 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-3 transition-colors hover:border-[var(--wc-basil)]"
								>
									<Avatar username={u.username} url={u.avatar_url} className="h-10 w-10 text-base" />
									<span className="truncate font-medium text-[var(--wc-text)]">{u.username}</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}

			{query && results.length > 0 && (
				<h2 className="mt-8 font-display text-xl text-[var(--wc-saffron)]">Ricette</h2>
			)}
			<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{results.map((recipe) => (
					<RecipeCard key={recipe.id} recipe={recipe} />
				))}
			</div>
		</div>
	)
}

export default SearchResults
