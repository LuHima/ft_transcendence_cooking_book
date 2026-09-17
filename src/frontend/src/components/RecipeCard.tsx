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

	return (
		<Link
			to={`/recipes/${recipe.id}`}
			className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] transition-colors hover:border-[var(--wc-basil)]"
		>
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
				<h3 className="font-display text-lg leading-tight text-[var(--wc-text)]">{recipe.title}</h3>
				<p className="line-clamp-2 text-sm text-[var(--wc-text-muted)]">{recipe.description}</p>
				<div className="mt-auto flex items-center justify-between pt-2 text-xs text-[var(--wc-text-muted)]">
					{recipe.difficulty && (
						<span className="rounded-full border border-[var(--wc-border)] px-2 py-0.5">
							{difficultyLabel[recipe.difficulty]}
						</span>
					)}
					{recipe.prep_time != null && <span>{recipe.prep_time} min</span>}
					{recipe.user?.username && <span>di {recipe.user.username}</span>}
				</div>
			</div>
		</Link>
	)
}

export default RecipeCard
