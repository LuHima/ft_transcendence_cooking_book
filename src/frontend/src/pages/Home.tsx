import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import KitchenScene from '../3d/KitchenScene'
import { api } from '../api/client'
import type { Recipe } from '../types/models'

function Home() {
	const [recentRecipes, setRecentRecipes] = useState<Pick<Recipe, 'id' | 'title'>[]>([])
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		api
			.get<Pick<Recipe, 'id' | 'title'>[]>('/recipes')
			.then((data) => setRecentRecipes(data.slice(0, 8)))
			.catch(() => setError('Non è stato possibile caricare le ricette al momento.'))
	}, [])

	return (
		<div>
			<section className="relative h-[70vh] w-full overflow-hidden">
				<KitchenScene />
				<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[var(--wc-bg)] to-transparent p-8">
					<h1 className="font-display text-4xl text-[var(--wc-text)] md:text-5xl">La tua cucina, organizzata.</h1>
					<p className="mt-2 max-w-md text-[var(--wc-text-muted)]">
						Salva le tue ricette, pianifica la settimana e ritrova subito i tuoi piatti preferiti.
					</p>
				</div>
			</section>

			<section className="mx-auto max-w-7xl px-4 py-12">
				<div className="mb-6 flex items-center justify-between">
					<h2 className="font-display text-2xl text-[var(--wc-saffron)]">Ricette recenti</h2>
					<Link to="/search" className="text-sm text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]">
						Vedi tutte
					</Link>
				</div>

				{error && <p className="text-[var(--wc-paprika)]">{error}</p>}

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{recentRecipes.map((r) => (
						<Link
							key={r.id}
							to={`/recipes/${r.id}`}
							className="rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4 hover:border-[var(--wc-basil)]"
						>
							<span className="font-display text-lg">{r.title}</span>
						</Link>
					))}
					{!error && recentRecipes.length === 0 && (
						<p className="text-[var(--wc-text-muted)]">Nessuna ricetta pubblicata ancora.</p>
					)}
				</div>
			</section>
		</div>
	)
}

export default Home
