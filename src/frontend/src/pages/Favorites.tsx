import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import RecipeCard from '../components/RecipeCard'
import type { Recipe } from '../types/models'

function Favorites() {
	const [recipes, setRecipes] = useState<Recipe[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		// si appoggia a GET /api/users/me/likes, endpoint da esporre lato backend
		api
			.get<Recipe[]>('/users/me/likes')
			.then(setRecipes)
			.catch((err) => setError(err instanceof ApiError ? err.message : 'Impossibile caricare i preferiti.'))
	}, [])

	return (
		<div className="mx-auto max-w-7xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">Le mie ricette preferite</h1>

			{error && <p className="mt-6 text-[var(--wc-paprika)]">{error}</p>}

			{!error && recipes && recipes.length === 0 && (
				<p className="mt-6 text-[var(--wc-text-muted)]">
					Non hai ancora messo like a nessuna ricetta. Esplora le ricette e salva quelle che ti piacciono.
				</p>
			)}

			<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{recipes?.map((recipe) => (
					<RecipeCard key={recipe.id} recipe={recipe} />
				))}
			</div>
		</div>
	)
}

export default Favorites
