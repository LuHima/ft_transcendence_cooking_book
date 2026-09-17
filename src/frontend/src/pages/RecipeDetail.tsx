import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import type { Recipe, RecipeDifficulty } from '../types/models'

const difficultyLabel: Record<RecipeDifficulty, string> = {
	easy: 'Facile',
	medium: 'Media',
	hard: 'Difficile',
}

function RecipeDetail() {
	const { id } = useParams()
	const { user } = useAuth()
	const navigate = useNavigate()
	const [recipe, setRecipe] = useState<Recipe | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [liking, setLiking] = useState(false)

	useEffect(() => {
		api
			.get<Recipe>(`/recipes/${id}`)
			.then(setRecipe)
			.catch((err) => setError(err instanceof ApiError ? err.message : 'Ricetta non trovata.'))
	}, [id])

	async function toggleLike() {
		if (!recipe || !user) return navigate('/login')
		setLiking(true)
		try {
			// NB: endpoint da esporre lato backend a partire dal modello Like già in Prisma.
			if (recipe.liked_by_me) {
				await api.delete(`/recipes/${recipe.id}/like`)
				setRecipe({ ...recipe, liked_by_me: false, likes_count: (recipe.likes_count ?? 1) - 1 })
			} else {
				await api.post(`/recipes/${recipe.id}/like`)
				setRecipe({ ...recipe, liked_by_me: true, likes_count: (recipe.likes_count ?? 0) + 1 })
			}
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Impossibile aggiornare il like.')
		} finally {
			setLiking(false)
		}
	}

	if (error) {
		return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-paprika)]">{error}</p>
	}
	if (!recipe) {
		return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-text-muted)]">Caricamento…</p>
	}

	const isOwner = user && recipe.user_id === user.id

	return (
		<div className="mx-auto max-w-3xl px-4 py-12">
			{recipe.recipe_media && recipe.recipe_media.length > 0 && (
				<div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
					{recipe.recipe_media.map((m) =>
						m.media_type === 'image' ? (
							<img key={m.id} src={m.url} alt={recipe.title} className="aspect-square rounded-xl object-cover" />
						) : (
							<video key={m.id} src={m.url} controls className="aspect-square rounded-xl object-cover" />
						),
					)}
				</div>
			)}

			<div className="flex items-start justify-between gap-4">
				<h1 className="font-display text-4xl text-[var(--wc-text)]">{recipe.title}</h1>
				<button
					onClick={toggleLike}
					disabled={liking}
					className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${
						recipe.liked_by_me
							? 'border-[var(--wc-saffron)] bg-[var(--wc-saffron)] text-[var(--wc-bg)]'
							: 'border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-saffron)]'
					}`}
				>
					♥ {recipe.likes_count ?? 0}
				</button>
			</div>

			<div className="mt-2 flex flex-wrap gap-3 text-sm text-[var(--wc-text-muted)]">
				{recipe.difficulty && <span>{difficultyLabel[recipe.difficulty]}</span>}
				{recipe.prep_time != null && (
					<>
						<span>·</span>
						<span>{recipe.prep_time} min</span>
					</>
				)}
				{recipe.user?.username && (
					<>
						<span>·</span>
						<span>di {recipe.user.username}</span>
					</>
				)}
			</div>

			{isOwner && (
				<div className="mt-4">
					<Link
						to={`/my-recipes/${recipe.id}/edit`}
						className="rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm hover:border-[var(--wc-basil)]"
					>
						Modifica ricetta
					</Link>
				</div>
			)}

			<p className="mt-6 text-[var(--wc-text)]">{recipe.description}</p>

			{recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0 && (
				<section className="mt-8">
					<h2 className="font-display text-xl text-[var(--wc-saffron)]">Ingredienti</h2>
					<ul className="mt-3 space-y-1 text-[var(--wc-text)]">
						{recipe.recipe_ingredients.map((ri, i) => (
							<li key={i}>
								{ri.quantity} {ri.unit} {ri.ingredient.name}
							</li>
						))}
					</ul>
				</section>
			)}

			<section className="mt-8">
				<h2 className="font-display text-xl text-[var(--wc-saffron)]">Preparazione</h2>
				<p className="mt-3 whitespace-pre-line text-[var(--wc-text)]">{recipe.instructions}</p>
			</section>
		</div>
	)
}

export default RecipeDetail
