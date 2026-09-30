import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, ApiError } from '../api/client'
import type { RecipeComment } from '../types/models'

const MAX_LENGTH = 1000

function formatDate(iso: string) {
	return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Comments({ recipeId }: { recipeId: number }) {
	const { user } = useAuth()
	const [comments, setComments] = useState<RecipeComment[] | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [content, setContent] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState<string | null>(null)

	// NB: endpoint da esporre lato backend: GET/POST /recipes/:id/comments, DELETE /comments/:id
	useEffect(() => {
		let cancelled = false
		api
			.get<RecipeComment[]>(`/recipes/${recipeId}/comments`)
			.then((data) => {
				if (!cancelled) setComments(data)
			})
			.catch((err) => {
				if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Impossibile caricare i commenti.')
			})
		return () => {
			cancelled = true
		}
	}, [recipeId])

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		const text = content.trim()
		if (!text) return
		setSubmitting(true)
		setSubmitError(null)
		try {
			const created = await api.post<RecipeComment>(`/recipes/${recipeId}/comments`, { content: text })
			setComments((prev) => [created, ...(prev ?? [])])
			setContent('')
		} catch (err) {
			setSubmitError(err instanceof ApiError ? err.message : 'Impossibile pubblicare il commento.')
		} finally {
			setSubmitting(false)
		}
	}

	async function handleDelete(commentId: number) {
		try {
			await api.delete(`/comments/${commentId}`)
			setComments((prev) => prev?.filter((c) => c.id !== commentId) ?? null)
		} catch (err) {
			setSubmitError(err instanceof ApiError ? err.message : 'Impossibile eliminare il commento.')
		}
	}

	return (
		<section className="mt-12 border-t border-[var(--wc-border)] pt-8">
			<h2 className="font-display text-xl text-[var(--wc-saffron)]">
				Commenti{comments ? ` (${comments.length})` : ''}
			</h2>

			{user ? (
				<form onSubmit={handleSubmit} className="mt-4 space-y-2">
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						maxLength={MAX_LENGTH}
						rows={3}
						placeholder="Scrivi un commento…"
						aria-label="Scrivi un commento"
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
					/>
					<div className="flex items-center justify-between">
						<span className="text-xs text-[var(--wc-text-muted)]">
							{content.length}/{MAX_LENGTH}
						</span>
						<button
							type="submit"
							disabled={submitting || !content.trim()}
							className="rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
						>
							{submitting ? 'Invio…' : 'Commenta'}
						</button>
					</div>
				</form>
			) : (
				<p className="mt-4 text-sm text-[var(--wc-text-muted)]">
					<Link to="/login" className="text-[var(--wc-saffron)] hover:underline">
						Accedi
					</Link>{' '}
					per lasciare un commento.
				</p>
			)}

			{submitError && <p className="mt-2 text-sm text-[var(--wc-paprika)]">{submitError}</p>}
			{loadError && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{loadError}</p>}

			{comments && comments.length === 0 && (
				<p className="mt-6 text-sm text-[var(--wc-text-muted)]">Ancora nessun commento. Scrivi tu il primo!</p>
			)}

			<ul className="mt-6 space-y-4">
				{comments?.map((c) => (
					<li key={c.id} className="rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4">
						<div className="flex items-center justify-between gap-3 text-xs text-[var(--wc-text-muted)]">
							<span>
								<span className="font-semibold text-[var(--wc-text)]">{c.user.username}</span> ·{' '}
								{formatDate(c.created_at)}
							</span>
							{user && (user.id === c.user_id || user.role === 'admin') && (
								<button
									type="button"
									onClick={() => handleDelete(c.id)}
									className="text-[var(--wc-paprika)] hover:underline"
								>
									Elimina
								</button>
							)}
						</div>
						<p className="mt-2 whitespace-pre-line break-words text-sm text-[var(--wc-text)]">{c.content}</p>
					</li>
				))}
			</ul>
		</section>
	)
}

export default Comments
