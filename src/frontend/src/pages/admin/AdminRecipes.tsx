import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, asArray } from '../../api/client'
import type { Recipe } from '../../types/models'

// NB: endpoint da esporre lato backend (guard: solo admin): GET /admin/recipes -> Recipe[].
// L'eliminazione usa DELETE /recipes/:id, che il backend deve consentire a proprietario e admin.
function AdminRecipes() {
	const [recipes, setRecipes] = useState<Recipe[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [filter, setFilter] = useState('')
	const [deletingId, setDeletingId] = useState<number | null>(null)

	useEffect(() => {
		api
			.get<Recipe[]>('/admin/recipes')
			.then((data) => setRecipes(asArray<Recipe>(data)))
			.catch((err) => {
				setRecipes([])
				setError(err instanceof ApiError ? err.message : 'Impossibile caricare le ricette.')
			})
	}, [])

	const visible = useMemo(() => {
		const q = filter.trim().toLowerCase()
		if (!q || !recipes) return recipes ?? []
		return recipes.filter(
			(r) => r.title.toLowerCase().includes(q) || (r.user?.username ?? '').toLowerCase().includes(q),
		)
	}, [recipes, filter])

	async function handleDelete(r: Recipe) {
		if (!confirm(`Rimuovere la ricetta "${r.title}"? L'azione non è reversibile.`)) return
		setDeletingId(r.id)
		setError(null)
		try {
			await api.delete(`/recipes/${r.id}`)
			setRecipes((prev) => prev?.filter((x) => x.id !== r.id) ?? null)
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Impossibile eliminare la ricetta.')
		} finally {
			setDeletingId(null)
		}
	}

	return (
		<div>
			<input
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
				placeholder="Filtra per titolo o autore…"
				aria-label="Filtra ricette"
				className="w-full max-w-xs rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
			/>
			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{recipes === null && <p className="mt-6 text-[var(--wc-text-muted)]">Caricamento…</p>}
			{recipes && visible.length === 0 && !error && (
				<p className="mt-6 text-[var(--wc-text-muted)]">Nessuna ricetta trovata.</p>
			)}

			{visible.length > 0 && (
				<div className="mt-4 divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
					{visible.map((r) => (
						<div key={r.id} className="flex items-center justify-between gap-4 p-4">
							<div className="min-w-0">
								<Link to={`/recipes/${r.id}`} className="font-display text-lg hover:text-[var(--wc-saffron)]">
									{r.title}
								</Link>
								<p className="text-xs text-[var(--wc-text-muted)]">
									di {r.owner_type === 'platform' || !r.user ? 'WeCook' : r.user.username}
								</p>
							</div>
							<div className="flex shrink-0 items-center gap-2 text-sm">
								<Link
									to={`/my-recipes/${r.id}/edit`}
									className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 hover:border-[var(--wc-basil)]"
								>
									Modifica
								</Link>
								<button
									onClick={() => handleDelete(r)}
									disabled={deletingId === r.id}
									className="rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-[var(--wc-paprika)] hover:border-[var(--wc-paprika)] disabled:opacity-50"
								>
									Rimuovi
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export default AdminRecipes
