import { Link } from 'react-router-dom'
import type { Recipe, RecipeDifficulty } from '../types/models'

const difficultyLabel: Record<RecipeDifficulty, string> = {
	easy: 'Facile',
	medium: 'Media',
	hard: 'Difficile',
}

interface RecipeCardProps {
	recipe: Recipe
}

function RecipeCard({ recipe }: RecipeCardProps) {
	const cover = recipe.recipe_media?.find((m) => m.media_type === 'image')
	const ingredientNames = recipe.recipe_ingredients?.map((ri) => ri.ingredient.name) ?? []
	const isPlatform = recipe.owner_type ? recipe.owner_type === 'platform' : recipe.user_id == null
	const authorId = recipe.user?.id ?? recipe.user_id ?? null
	const authorName = recipe.user?.username ?? 'utente'

	// niente <Link> annidati: il titolo copre tutta la card (after:absolute), l'autore sta sopra (z-10)
	return (
		<div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] transition-colors hover:border-[var(--wc-basil)]">
			<div className="aspect-[4/3] w-full overflow-hidden bg-[var(--wc-surface-raised)]">
				{cover ? (
					<img
						src={cover.url}
						alt={recipe.title}
						className="h-full w-full object-cover transition-transform group-hover:scale-105"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-sm text-[var(--wc-text-muted)]">
						Nessuna foto
					</div>
				)}
			</div>
			<div className="flex flex-1 flex-col gap-2 p-4">
				<h3 className="font-display text-lg leading-tight text-[var(--wc-text)]">
					<Link to={`/recipes/${recipe.id}`} className="after:absolute after:inset-0">
						{recipe.title}
					</Link>
				</h3>
				<p className="line-clamp-2 text-sm text-[var(--wc-text-muted)]">{recipe.description}</p>
				{ingredientNames.length > 0 && (
					<p className="line-clamp-1 text-xs text-[var(--wc-text-muted)]">
						<span className="text-[var(--wc-text)]">Ingredienti:</span> {ingredientNames.join(', ')}
					</p>
				)}
				<div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-[var(--wc-text-muted)]">
					{recipe.difficulty && (
						<span className="rounded-full border border-[var(--wc-border)] px-2 py-0.5">
							{difficultyLabel[recipe.difficulty]}
						</span>
					)}
					{recipe.prep_time != null && <span>{recipe.prep_time} min</span>}
					{isPlatform ? (
					<span className="text-[var(--wc-saffron)]">di WeCook</span>
				) : authorId != null ? (
					<span className="relative z-10 truncate">
						di{' '}
						<Link to={`/users/${authorId}`} className="hover:text-[var(--wc-saffron)] hover:underline">
							{authorName}
						</Link>
					</span>
				) : null}
				</div>
			</div>
		</div>
	)
}

export default RecipeCard
