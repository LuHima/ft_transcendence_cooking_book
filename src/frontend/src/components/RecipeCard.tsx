import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { assetUrl } from '../api/client'
import type { RecipeSummary } from '../types/models'

interface RecipeCardProps {
	recipe: RecipeSummary
}

const MAX_TAGS = 3

function RecipeCard({ recipe }: RecipeCardProps) {
	const { t } = useTranslation()
	const cover = assetUrl(recipe.cover_image_url)
	const author = recipe.author

	// niente <Link> annidati: il titolo copre tutta la card (after:absolute), l'autore sta sopra (z-10)
	return (
		<div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] transition-colors hover:border-[var(--wc-basil)]">
			<div className="aspect-[4/3] w-full overflow-hidden bg-[var(--wc-surface-raised)]">
				{cover ? (
					<img
						src={cover}
						alt={recipe.title}
						loading="lazy"
						className="h-full w-full object-cover transition-transform group-hover:scale-105"
					/>
				) : (
					<div className="flex h-full items-center justify-center text-sm text-[var(--wc-text-muted)]">
						{t('recipe.noPhoto')}
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

				{recipe.tags.length > 0 && (
					<ul className="flex flex-wrap gap-1.5">
						{recipe.tags.slice(0, MAX_TAGS).map((tag) => (
							<li
								key={tag.id}
								className="rounded-full bg-[var(--wc-surface-raised)] px-2 py-0.5 text-[11px] text-[var(--wc-text-muted)]"
							>
								{tag.name}
							</li>
						))}
						{recipe.tags.length > MAX_TAGS && (
							<li className="px-1 text-[11px] text-[var(--wc-text-muted)]">+{recipe.tags.length - MAX_TAGS}</li>
						)}
					</ul>
				)}

				<div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-2 text-xs text-[var(--wc-text-muted)]">
					<span className="rounded-full border border-[var(--wc-border)] px-2 py-0.5">
						{t(`difficulty.${recipe.difficulty}`)}
					</span>
					<span>{t('recipe.minutes', { count: recipe.total_time })}</span>
					<span aria-label={t('recipe.likes', { count: recipe.likes_count })}>♥ {recipe.likes_count}</span>
					{author ? (
						<span className="relative z-10 min-w-0 truncate">
							{t('recipe.by')}{' '}
							<Link to={`/users/${author.id}`} className="hover:text-[var(--wc-saffron)] hover:underline">
								{author.username}
							</Link>
						</span>
					) : (
						<span className="text-[var(--wc-saffron)]">{t('recipe.byPlatform')}</span>
					)}
				</div>
			</div>
		</div>
	)
}

export default RecipeCard
