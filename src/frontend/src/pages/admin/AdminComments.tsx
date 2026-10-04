import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, asArray } from '../../api/client'
import type { AdminComment } from '../../types/models'

// NB: endpoint da esporre lato backend (guard: solo admin): GET /admin/comments -> AdminComment[]
// (con user e recipe incluse). L'eliminazione usa DELETE /comments/:id, consentito ad autore e admin.
function AdminComments() {
	const [comments, setComments] = useState<AdminComment[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [filter, setFilter] = useState('')
	const [deletingId, setDeletingId] = useState<number | null>(null)

	useEffect(() => {
		api
			.get<AdminComment[]>('/admin/comments')
			.then((data) => setComments(asArray<AdminComment>(data)))
			.catch((err) => {
				setComments([])
				setError(err instanceof ApiError ? err.message : 'Impossibile caricare i commenti.')
			})
	}, [])

	const visible = useMemo(() => {
		const q = filter.trim().toLowerCase()
		if (!q || !comments) return comments ?? []
		return comments.filter(
			(c) => c.content.toLowerCase().includes(q) || c.user.username.toLowerCase().includes(q),
		)
	}, [comments, filter])

	async function handleDelete(c: AdminComment) {
		if (!confirm('Rimuovere questo commento?')) return
		setDeletingId(c.id)
		setError(null)
		try {
			await api.delete(`/comments/${c.id}`)
			setComments((prev) => prev?.filter((x) => x.id !== c.id) ?? null)
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Impossibile eliminare il commento.')
		} finally {
			setDeletingId(null)
		}
	}

	return (
		<div>
			<input
				value={filter}
				onChange={(e) => setFilter(e.target.value)}
				placeholder="Filtra per testo o autore…"
				aria-label="Filtra commenti"
				className="w-full max-w-xs rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
			/>
			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{comments === null && <p className="mt-6 text-[var(--wc-text-muted)]">Caricamento…</p>}
			{comments && visible.length === 0 && !error && (
				<p className="mt-6 text-[var(--wc-text-muted)]">Nessun commento trovato.</p>
			)}

			<ul className="mt-4 space-y-3">
				{visible.map((c) => (
					<li key={c.id} className="rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4">
						<div className="flex items-start justify-between gap-3 text-xs text-[var(--wc-text-muted)]">
							<span>
								<Link to={`/users/${c.user.id}`} className="font-semibold text-[var(--wc-text)] hover:text-[var(--wc-saffron)]">
									{c.user.username}
								</Link>{' '}
								su{' '}
								<Link to={`/recipes/${c.recipe_id}`} className="hover:text-[var(--wc-saffron)] hover:underline">
									{c.recipe?.title ?? `ricetta #${c.recipe_id}`}
								</Link>{' '}
								· {new Date(c.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
							</span>
							<button
								onClick={() => handleDelete(c)}
								disabled={deletingId === c.id}
								className="shrink-0 text-[var(--wc-paprika)] hover:underline disabled:opacity-50"
							>
								Rimuovi
							</button>
						</div>
						<p className="mt-2 whitespace-pre-line break-words text-sm text-[var(--wc-text)]">{c.content}</p>
					</li>
				))}
			</ul>
		</div>
	)
}

export default AdminComments
