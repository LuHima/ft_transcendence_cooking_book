import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, getErrorMessage } from '../api/client'
import { useLang } from '../lib/useLang'
import Avatar from './Avatar'
import { ReportButton } from './ReportDialog'
import { Skeleton } from './Skeleton'
import type { ApiComment, ThreadedComment } from '../types/models'

const MAX_LENGTH = 1000

interface CommentsProps {
	recipeId: number
	// l'autore della ricetta può rimuovere i commenti sotto la propria ricetta (regola del backend)
	recipeAuthorId?: number | null
}

interface CommentFormProps {
	initial?: string
	submitLabel: string
	placeholder: string
	autoFocus?: boolean
	onSubmit: (content: string) => Promise<void>
	onCancel?: () => void
}

function CommentForm({ initial = '', submitLabel, placeholder, autoFocus, onSubmit, onCancel }: CommentFormProps) {
	const { t } = useTranslation()
	const [content, setContent] = useState(initial)
	const [submitting, setSubmitting] = useState(false)

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		const text = content.trim()
		if (!text) return
		setSubmitting(true)
		try {
			await onSubmit(text)
			setContent('')
		} catch {
			// l'errore viene mostrato dal chiamante con un toast; il testo resta nel campo
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-2">
			<textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				maxLength={MAX_LENGTH}
				rows={3}
				autoFocus={autoFocus}
				placeholder={placeholder}
				aria-label={placeholder}
				className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
			/>
			<div className="flex items-center justify-between gap-2">
				<span className="text-xs text-[var(--wc-text-muted)]">
					{content.length}/{MAX_LENGTH}
				</span>
				<div className="flex items-center gap-2">
					{onCancel && (
						<button
							type="button"
							onClick={onCancel}
							className="rounded-full px-4 py-2 text-sm text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]"
						>
							{t('common.cancel')}
						</button>
					)}
					<button
						type="submit"
						disabled={submitting || !content.trim()}
						className="rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						{submitting ? t('common.sending') : submitLabel}
					</button>
				</div>
			</div>
		</form>
	)
}

function Comments({ recipeId, recipeAuthorId }: CommentsProps) {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const { user } = useAuth()
	const [threads, setThreads] = useState<ThreadedComment[] | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [replyingTo, setReplyingTo] = useState<number | null>(null)
	const [editing, setEditing] = useState<number | null>(null)

	useEffect(() => {
		let cancelled = false
		api
			.get<ThreadedComment[]>(`/recipes/${recipeId}/comments`)
			.then((data) => {
				if (!cancelled) setThreads(Array.isArray(data) ? data : [])
			})
			.catch((err) => {
				if (!cancelled) setLoadError(getErrorMessage(err, t('comments.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [recipeId, t])

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })
	}

	async function addComment(content: string, parentId?: number) {
		try {
			const created = await api.post<ApiComment>(`/recipes/${recipeId}/comments`, {
				content,
				...(parentId ? { parent_id: parentId } : {}),
			})
			setThreads((prev) => {
				const list = prev ?? []
				if (!parentId) return [{ ...created, replies: [] }, ...list]
				return list.map((th) => (th.id === parentId ? { ...th, replies: [...th.replies, created] } : th))
			})
			setReplyingTo(null)
			toast.success(t('comments.posted'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('comments.postError')))
			throw err
		}
	}

	async function editComment(comment: ApiComment, content: string) {
		try {
			const updated = await api.patch<ApiComment>(`/recipes/${recipeId}/comments/${comment.id}`, { content })
			const apply = (c: ApiComment): ApiComment => (c.id === comment.id ? { ...c, ...updated } : c)
			setThreads(
				(prev) => prev?.map((th) => ({ ...th, ...apply(th), replies: th.replies.map(apply) })) ?? null,
			)
			setEditing(null)
			toast.success(t('comments.updated'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('comments.updateError')))
			throw err
		}
	}

	async function deleteComment(comment: ApiComment) {
		if (!confirm(t('comments.confirmDelete'))) return
		try {
			// eliminazione non distruttiva: il backend imposta is_active = false
			await api.delete(`/recipes/${recipeId}/comments/${comment.id}`)
			const deactivate = (c: ApiComment): ApiComment => (c.id === comment.id ? { ...c, is_active: false, content: null } : c)
			setThreads(
				(prev) =>
					prev
						?.map((th) => ({ ...th, ...deactivate(th), replies: th.replies.map(deactivate) }))
						// un commento principale disattivato e senza risposte attive non serve più
						.filter((th) => th.is_active || th.replies.some((r) => r.is_active)) ?? null,
			)
			toast.success(t('comments.deleted'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('comments.deleteError')))
		}
	}

	function renderComment(c: ApiComment, rootId: number, isReply: boolean) {
		const isAuthor = Boolean(user && c.user_id === user.id)
		const canDelete = c.is_active && Boolean(user && (isAuthor || recipeAuthorId === user.id))

		return (
			<li
				key={c.id}
				className={`rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4 ${isReply ? 'ml-6 sm:ml-10' : ''}`}
			>
				<div className="flex items-center justify-between gap-3 text-xs text-[var(--wc-text-muted)]">
					<span className="flex min-w-0 items-center gap-2">
						{c.user ? (
							<>
								<Avatar username={c.user.username} url={c.user.avatar_url} className="h-5 w-5 text-[10px]" />
								<Link
									to={`/users/${c.user.id}`}
									className="truncate font-semibold text-[var(--wc-text)] hover:text-[var(--wc-saffron)]"
								>
									{c.user.username}
								</Link>
							</>
						) : (
							<span className="font-semibold">{t('comments.deletedUser')}</span>
						)}
						<span>· {formatDate(c.created_at)}</span>
						{c.is_edited && c.is_active && <span className="italic">({t('comments.edited')})</span>}
					</span>
					{c.is_active && (
						<span className="flex shrink-0 items-center gap-3">
							{isAuthor && (
								<button
									type="button"
									onClick={() => setEditing(editing === c.id ? null : c.id)}
									className="hover:text-[var(--wc-text)] hover:underline"
								>
									{t('common.edit')}
								</button>
							)}
							{c.is_active && !isAuthor && <ReportButton targetType="comment" targetId={c.id} ownerId={c.user_id} className="hover:text-[var(--wc-paprika)]" />}
							{canDelete && (
								<button
									type="button"
									onClick={() => void deleteComment(c)}
									className="text-[var(--wc-paprika)] hover:underline"
								>
									{t('common.delete')}
								</button>
							)}
						</span>
					)}
				</div>

				{!c.is_active ? (
					<p className="mt-2 text-sm italic text-[var(--wc-text-muted)]">{t('comments.removed')}</p>
				) : editing === c.id ? (
					<div className="mt-3">
						<CommentForm
							initial={c.content ?? ''}
							autoFocus
							submitLabel={t('common.save')}
							placeholder={t('comments.editPlaceholder')}
							onSubmit={(content) => editComment(c, content)}
							onCancel={() => setEditing(null)}
						/>
					</div>
				) : (
					<p className="mt-2 whitespace-pre-line break-words text-sm text-[var(--wc-text)]">{c.content}</p>
				)}

				{user && c.is_active && editing !== c.id && (
					<button
						type="button"
						onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
						className="mt-2 text-xs text-[var(--wc-saffron)] hover:underline"
					>
						{t('comments.reply')}
					</button>
				)}

				{replyingTo === c.id && (
					<div className="mt-3">
						<CommentForm
							autoFocus
							submitLabel={t('comments.reply')}
							placeholder={t('comments.replyPlaceholder')}
							// le risposte a una risposta vengono agganciate al commento principale (thread a 2 livelli)
							onSubmit={(content) => addComment(content, rootId)}
							onCancel={() => setReplyingTo(null)}
						/>
					</div>
				)}
			</li>
		)
	}

	const activeCount = threads?.reduce((n, th) => n + (th.is_active ? 1 : 0) + th.replies.filter((r) => r.is_active).length, 0)

	return (
		<section className="mt-12 border-t border-[var(--wc-border)] pt-8">
			<h2 className="font-display text-xl text-[var(--wc-saffron)]">
				{t('comments.title')}
				{threads ? ` (${activeCount})` : ''}
			</h2>

			{user ? (
				<div className="mt-4">
					<CommentForm
						submitLabel={t('comments.submit')}
						placeholder={t('comments.placeholder')}
						onSubmit={(content) => addComment(content)}
					/>
				</div>
			) : (
				<p className="mt-4 text-sm text-[var(--wc-text-muted)]">
					<Link to="/login" className="text-[var(--wc-saffron)] hover:underline">
						{t('comments.loginLink')}
					</Link>{' '}
					{t('comments.loginToComment')}
				</p>
			)}

			{loadError && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{loadError}</p>}

			{!threads && !loadError && (
				<div role="status" aria-busy="true" className="mt-6 space-y-4">
					<Skeleton className="h-20 w-full rounded-xl" />
					<Skeleton className="h-20 w-full rounded-xl" />
				</div>
			)}

			{threads && threads.length === 0 && (
				<p className="mt-6 text-sm text-[var(--wc-text-muted)]">{t('comments.empty')}</p>
			)}

			<ul className="mt-6 space-y-3">
				{threads?.map((th) => (
					<li key={th.id} className="list-none">
						<ul className="space-y-3">
							{renderComment(th, th.id, false)}
							{th.replies.map((r) => renderComment(r, th.id, true))}
						</ul>
					</li>
				))}
			</ul>
		</section>
	)
}

export default Comments
