import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import type { Recipe, RecipeDifficulty } from '../types/models'

const difficultyLabel: Record<RecipeDifficulty, string> = {
	easy: 'Facile',
	medium: 'Media',
	hard: 'Difficile',
}

function MyRecipes() {
	const { user } = useAuth()
	const [recipes, setRecipes] = useState<Recipe[]>([])
	const [error, setError] = useState<string | null>(null)
	const [deletingId, setDeletingId] = useState<number | null>(null)

	function load() {
		// NB: idealmente il backend filtra già per utente loggato (es. GET /api/recipes?mine=true);
		// finché non è disponibile, qui si filtra lato client sull'elenco completo.
		api
			.get<Recipe[]>('/recipes?mine=true')
			.then((data) => setRecipes(user ? data.filter((r) => r.user_id === user.id) : data))
			.catch((err) => setError(err instanceof ApiError ? err.message : 'Impossibile caricare le ricette.'))
	}

	useEffect(load, [user])

	async function handleDelete(id: number) {
		if (!confirm('Eliminare questa ricetta? L\'azione non è reversibile.')) return
		setDeletingId(id)
		try {
			await api.delete(`/recipes/${id}`)
			setRecipes((prev) => prev.filter((r) => r.id !== id))
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Impossibile eliminare la ricetta.')
		} finally {
			setDeletingId(null)
		}
	}

	return (
		<div className="mx-auto max-w-5xl px-4 py-12">
			<div className="mb-6 flex items-center justify-between">
				<h1 className="font-display text-3xl text-[var(--wc-saffron)]">Le mie ricette</h1>
				<Link
					to="/my-recipes/new"
					className="rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
				>
					+ Nuova ricetta
				</Link>
			</div>

			{error && <p className="mb-4 text-[var(--wc-paprika)]">{error}</p>}

			{recipes.length === 0 && !error && (
				<p className="text-[var(--wc-text-muted)]">Non hai ancora pubblicato nessuna ricetta.</p>
			)}

			<div className="divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
				{recipes.map((recipe) => (
					<div key={recipe.id} className="flex items-center justify-between gap-4 p-4">
						<div>
							<Link to={`/recipes/${recipe.id}`} className="font-display text-lg hover:text-[var(--wc-saffron)]">
								{recipe.title}
							</Link>
							<p className="text-xs text-[var(--wc-text-muted)]">
								{recipe.difficulty ? difficultyLabel[recipe.difficulty] : ''} · {recipe.prep_time ?? '?'} min
							</p>
						</div>
						<div className="flex shrink-0 items-center gap-2 text-sm">
							<Link
								to={`/my-recipes/${recipe.id}/edit`}
								className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 hover:border-[var(--wc-basil)]"
							>
								Modifica
							</Link>
							<button
								onClick={() => handleDelete(recipe.id)}
								disabled={deletingId === recipe.id}
								className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-50"
							>
								Elimina
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

export default MyRecipes
