import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import Comments from '../components/Comments'
import Avatar from '../components/Avatar'
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
	const [deleting, setDeleting] = useState(false)

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

	async function handleDelete() {
		if (!recipe) return
		const moderation = isAdmin && !isOwner
		const message = moderation
			? 'Rimuovere questa ricetta come amministratore? L\'azione non è reversibile.'
			: 'Eliminare questa ricetta? L\'azione non è reversibile.'
		if (!confirm(message)) return
		setDeleting(true)
		try {
			await api.delete(`/recipes/${recipe.id}`)
			navigate(moderation ? '/admin' : '/my-recipes')
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Impossibile eliminare la ricetta.')
			setDeleting(false)
		}
	}

	if (error && !recipe) {
		return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-paprika)]">{error}</p>
	}
	if (!recipe) {
		return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-text-muted)]">Caricamento…</p>
	}

	const isOwner = Boolean(user && recipe.user_id === user.id)
	const isAdmin = user?.role === 'admin'
	// solo il proprietario o un admin possono modificare / eliminare
	const canManage = isOwner || isAdmin
	// la ricetta è della piattaforma solo se lo dice owner_type (o, se manca, se non ha un user_id);
	// un autore mancante nella risposta NON significa piattaforma
	const isPlatform = recipe.owner_type ? recipe.owner_type === 'platform' : recipe.user_id == null
	const authorId = recipe.user?.id ?? recipe.user_id ?? null
	const authorName = recipe.user?.username ?? 'Utente'

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

			{/* box informativi: stessa dimensione per difficoltà, tempo e autore */}
			<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div className="flex h-16 flex-col justify-center rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4">
					<span className="text-xs text-[var(--wc-text-muted)]">Difficoltà</span>
					<span className="text-sm font-medium text-[var(--wc-text)]">
						{recipe.difficulty ? difficultyLabel[recipe.difficulty] : '—'}
					</span>
				</div>
				<div className="flex h-16 flex-col justify-center rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4">
					<span className="text-xs text-[var(--wc-text-muted)]">Tempo di preparazione</span>
					<span className="text-sm font-medium text-[var(--wc-text)]">
						{recipe.prep_time != null ? `${recipe.prep_time} min` : '—'}
					</span>
				</div>
				<div className="flex h-16 flex-col justify-center rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] px-4">
					<span className="text-xs text-[var(--wc-text-muted)]">Pubblicata da</span>
					{isPlatform ? (
						<span className="text-sm font-medium text-[var(--wc-saffron)]">WeCook</span>
					) : authorId != null ? (
						<Link
							to={`/users/${authorId}`}
							className="flex items-center gap-2 text-sm font-medium text-[var(--wc-text)] hover:text-[var(--wc-saffron)]"
						>
							<Avatar username={authorName} url={recipe.user?.avatar_url} className="h-5 w-5 text-[10px]" />
							<span className="truncate">{authorName}</span>
						</Link>
					) : (
						<span className="text-sm font-medium text-[var(--wc-text-muted)]">—</span>
					)}
				</div>
		</div>

			{canManage && (
				<div className="mt-4 flex flex-wrap items-center gap-2">
					<Link
						to={`/my-recipes/${recipe.id}/edit`}
						className="rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm hover:border-[var(--wc-basil)]"
					>
						Modifica ricetta
					</Link>
					<button
						onClick={handleDelete}
						disabled={deleting}
						className="rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-50"
					>
						{isAdmin && !isOwner ? 'Rimuovi (admin)' : 'Elimina'}
					</button>
				</div>
			)}
			{error && <p className="mt-3 text-sm text-[var(--wc-paprika)]">{error}</p>}

			<p className="mt-6 text-[var(--wc-text)]">{recipe.description}</p>

			<section className="mt-8">
				<h2 className="font-display text-xl text-[var(--wc-saffron)]">Ingredienti</h2>
				{recipe.recipe_ingredients && recipe.recipe_ingredients.length > 0 ? (
					<ul className="mt-3 space-y-1 text-[var(--wc-text)]">
						{recipe.recipe_ingredients.map((ri, i) => (
							<li key={i}>
								{ri.quantity} {ri.unit} {ri.ingredient.name}
							</li>
						))}
					</ul>
				) : (
					<p className="mt-3 text-sm text-[var(--wc-text-muted)]">Nessun ingrediente indicato per questa ricetta.</p>
				)}
			</section>

			<section className="mt-8">
				<h2 className="font-display text-xl text-[var(--wc-saffron)]">Preparazione</h2>
				<p className="mt-3 whitespace-pre-line text-[var(--wc-text)]">{recipe.instructions}</p>
			</section>

			<Comments key={recipe.id} recipeId={recipe.id} />
		</div>
	)
}

export default RecipeDetail
