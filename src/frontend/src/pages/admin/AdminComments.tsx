import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, ApiError, getErrorMessage, qs, toPage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import { isAdmin } from '../../lib/permissions'
import ConfirmDialog from '../../components/ConfirmDialog'
import Pagination from '../../components/Pagination'
import { ListSkeleton } from '../../components/Skeleton'
import type { AdminComment, AdminCommentFormat, AdminCommentSortBy, AdminCommentStatus, Paginated, SortOrder } from '../../types/models'

const PAGE_SIZE = 15

const SORT_OPTIONS = [
	{ value: 'created_at:desc', label: 'newest' },
	{ value: 'created_at:asc', label: 'oldest' },
	{ value: 'reports_count:desc', label: 'mostReported' },
	{ value: 'recipe:asc', label: 'recipe' },
] as const
type SortValue = (typeof SORT_OPTIONS)[number]['value']

const STATUSES: AdminCommentStatus[] = ['all', 'active', 'inactive']

const INPUT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'

const positiveInt = (v: string) => (/^\d+$/.test(v.trim()) && Number(v) > 0 ? Number(v) : undefined)

// flusso di audit dei commenti (admin e moderatori; l'eliminazione definitiva è solo per gli admin):
// GET /admin/comments?page=&limit=&search=&status=&recipe_id=&user_id=&reported_only=&is_edited=&sort_by=&sort_order=&format=&lang=
// reported_only=true: solo commenti con segnalazioni in attesa; se sort_by non viene inviato il backend
// ordina per numero di segnalazioni. format = flat | threaded vale anche insieme a reported_only.
// Eliminazione: DELETE /recipes/:recipeId/comments/:commentId (soft) | ?hard=true (solo admin, definitiva)
function AdminComments() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const { user } = useAuth()
	const admin = isAdmin(user)
	const [data, setData] = useState<Paginated<AdminComment> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [debounced, setDebounced] = useState('')
	const [recipeIdText, setRecipeIdText] = useState('')
	const [userIdText, setUserIdText] = useState('')
	const [recipeId, setRecipeId] = useState<number | undefined>()
	const [userId, setUserId] = useState<number | undefined>()
	const [status, setStatus] = useState<AdminCommentStatus>('all')
	const [format, setFormat] = useState<AdminCommentFormat>('flat')
	const [reportedOnly, setReportedOnly] = useState(false)
	// solo commenti modificati dopo la pubblicazione (is_edited=true)
	const [editedOnly, setEditedOnly] = useState(false)
	const [sort, setSort] = useState<SortValue>('created_at:desc')
	const [page, setPage] = useState(1)
	const [reload, setReload] = useState(0)
	const [busyId, setBusyId] = useState<number | null>(null)
	const [purging, setPurging] = useState<{ comment: AdminComment; prune: boolean } | null>(null)

	// con "solo segnalati" l'ordinamento lo decide il backend (numero di segnalazioni)
	const [sortBy, sortOrder] = sort.split(':') as [AdminCommentSortBy, SortOrder]

	// filtri testuali: partono 300ms dopo l'ultimo tasto
	useEffect(() => {
		const id = window.setTimeout(() => {
			setDebounced(search.trim())
			setRecipeId(positiveInt(recipeIdText))
			setUserId(positiveInt(userIdText))
			setPage(1)
		}, 300)
		return () => window.clearTimeout(id)
	}, [search, recipeIdText, userIdText])

	useEffect(() => {
		let cancelled = false
		api
			.get<unknown>(
				`/admin/comments${qs({
					page,
					limit: PAGE_SIZE,
					search: debounced,
					status,
					recipe_id: recipeId,
					user_id: userId,
					reported_only: reportedOnly ? 'true' : undefined,
					is_edited: editedOnly ? 'true' : undefined,
					sort_by: reportedOnly ? undefined : sortBy,
					sort_order: reportedOnly ? undefined : sortOrder,
					format,
					lang,
				})}`,
			)
			.then((res) => {
				if (cancelled) return
				setData(toPage<AdminComment>(res, PAGE_SIZE))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setData(toPage<AdminComment>([], PAGE_SIZE))
				setError(getErrorMessage(err, t('comments.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, debounced, status, recipeId, userId, reportedOnly, editedOnly, sortBy, sortOrder, format, lang, reload, t])

	function refresh() {
		if (data && data.items.length === 1 && page > 1) setPage(page - 1)
		else setReload((n) => n + 1)
	}

	// DELETE soft: il commento resta nel database con is_active = false
	async function softDelete(c: AdminComment) {
		if (!confirm(t('comments.confirmDelete'))) return
		setBusyId(c.id)
		try {
			await api.delete(`/recipes/${c.recipe_id}/comments/${c.id}`)
			toast.success(t('comments.deleted'))
			refresh()
		} catch (err) {
			toast.error(getErrorMessage(err, t('comments.deleteError')))
		} finally {
			setBusyId(null)
		}
	}

	// DELETE ?hard=true: se il commento ha risposte il backend risponde 409, a meno di prune_replies=true
	async function hardDelete(c: AdminComment, prune: boolean) {
		try {
			await api.delete(`/recipes/${c.recipe_id}/comments/${c.id}${qs({ hard: 'true', prune_replies: prune ? 'true' : undefined })}`)
			toast.success(t('admin.comments.purged'))
			setPurging(null)
			refresh()
		} catch (err) {
			if (err instanceof ApiError && err.status === 409 && !prune) {
				// ha delle risposte: si chiede una seconda conferma per eliminarle insieme
				setPurging({ comment: c, prune: true })
				return
			}
			toast.error(getErrorMessage(err, t('comments.deleteError')))
			setPurging(null)
		}
	}

	const visible = data?.items ?? []
	const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })

	function renderComment(c: AdminComment, isReply = false) {
		return (
			<li
				key={c.id}
				className={`rounded-xl border bg-[var(--wc-surface)] p-4 ${
					c.has_pending_reports ? 'border-[var(--wc-paprika)]' : 'border-[var(--wc-border)]'
				} ${isReply ? 'ml-6' : ''}`}
			>
				<div className="flex flex-wrap items-start justify-between gap-3 text-xs text-[var(--wc-text-muted)]">
					<span>
						{c.user ? (
							<Link to={`/users/${c.user.id}`} className="font-semibold text-[var(--wc-text)] hover:text-[var(--wc-saffron)]">
								{c.user.username}
							</Link>
						) : (
							<span className="font-semibold">{t('comments.deletedUser')}</span>
						)}{' '}
						{t('admin.comments.on')}{' '}
						<Link to={`/recipes/${c.recipe_id}`} className="hover:text-[var(--wc-saffron)] hover:underline">
							{c.recipe?.title ?? `#${c.recipe_id}`}
						</Link>{' '}
						· {fmtDate(c.created_at)}
						{c.is_edited && ` · ${t('comments.edited')}`}
						{c.parent_id != null && !isReply && ` · ${t('admin.comments.replyTo', { id: c.parent_id })}`}
					</span>
					<span className="flex shrink-0 items-center gap-3">
						{c.has_pending_reports && (
							<span className="rounded-full bg-[var(--wc-paprika)] px-2 py-0.5 font-semibold text-[var(--wc-bg)]">
								⚑ {t('admin.comments.reported')}
								{(c.pending_reports_count ?? 0) > 0 && ` (${c.pending_reports_count})`}
							</span>
						)}
						{!c.has_pending_reports && c.reports_count > 0 && (
							<span className="rounded-full border border-[var(--wc-border)] px-2 py-0.5" title={t('admin.comments.totalReports')}>
								⚑ {c.reports_count}
							</span>
						)}
						{!c.is_active && (
							<span className="rounded-full border border-[var(--wc-border)] px-2 py-0.5 uppercase">{t('admin.comments.inactive')}</span>
						)}
						{c.is_active && (
							<button
								onClick={() => void softDelete(c)}
								disabled={busyId === c.id}
								className="text-[var(--wc-paprika)] hover:underline disabled:opacity-50"
							>
								{t('admin.comments.deactivate')}
							</button>
						)}
						{admin && (
							<button
								onClick={() => setPurging({ comment: c, prune: false })}
								disabled={busyId === c.id}
								className="font-semibold text-[var(--wc-paprika)] hover:underline disabled:opacity-50"
							>
								{t('admin.comments.purge')}
							</button>
						)}
					</span>
				</div>
				<p className={`mt-2 whitespace-pre-line break-words text-sm ${c.is_active ? 'text-[var(--wc-text)]' : 'text-[var(--wc-text-muted)] line-through'}`}>
					{c.content}
				</p>
				{/* vista a thread: riepilogo delle segnalazioni nella conversazione */}
				{!isReply && format === 'threaded' && ((c.thread_pending_reports_count ?? 0) > 0 || (c.reported_replies_count ?? 0) > 0) && (
					<p className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--wc-paprika)]">
						{(c.thread_pending_reports_count ?? 0) > 0 && (
							<span>{t('admin.comments.threadPending', { count: c.thread_pending_reports_count })}</span>
						)}
						{(c.reported_replies_count ?? 0) > 0 && (
							<span>{t('admin.comments.reportedReplies', { count: c.reported_replies_count })}</span>
						)}
					</p>
				)}
				{c.replies && c.replies.length > 0 && (
					<ul className="mt-3 space-y-2">{c.replies.map((r) => renderComment(r, true))}</ul>
				)}
				{c.has_more_replies && (
					<p className="mt-2 ml-6 text-xs text-[var(--wc-text-muted)]">
						{t('admin.comments.moreReplies', { count: (c.replies_count ?? 0) - (c.replies?.length ?? 0) })}
					</p>
				)}
			</li>
		)
	}

	return (
		<div>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<input
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder={t('admin.comments.filter')}
					aria-label={t('admin.comments.filter')}
					className={INPUT}
				/>
				<input
					inputMode="numeric"
					value={recipeIdText}
					onChange={(e) => setRecipeIdText(e.target.value.replace(/\D/g, ''))}
					placeholder={t('admin.comments.recipeId')}
					aria-label={t('admin.comments.recipeId')}
					className={INPUT}
				/>
				<input
					inputMode="numeric"
					value={userIdText}
					onChange={(e) => setUserIdText(e.target.value.replace(/\D/g, ''))}
					placeholder={t('admin.comments.userId')}
					aria-label={t('admin.comments.userId')}
					className={INPUT}
				/>
				<select
					value={sort}
					disabled={reportedOnly}
					aria-label={t('search.sortBy')}
					onChange={(e) => {
						setSort(e.target.value as SortValue)
						setPage(1)
					}}
					className={`${INPUT} disabled:opacity-50`}
				>
					{SORT_OPTIONS.map((o) => (
						<option key={o.value} value={o.value}>
							{t(`admin.comments.sort.${o.label}`)}
						</option>
					))}
				</select>
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
				<select
					value={status}
					aria-label={t('admin.users.status')}
					onChange={(e) => {
						setStatus(e.target.value as AdminCommentStatus)
						setPage(1)
					}}
					className={INPUT}
				>
					{STATUSES.map((s) => (
						<option key={s} value={s}>
							{t(`admin.comments.statuses.${s}`)}
						</option>
					))}
				</select>
				<div role="radiogroup" aria-label={t('admin.comments.threadMode')} className="inline-flex overflow-hidden rounded-full border border-[var(--wc-border)] text-xs">
					{(['flat', 'threaded'] as const).map((f) => (
						<button
							key={f}
							type="button"
							role="radio"
							aria-checked={format === f}
							onClick={() => {
								setFormat(f)
								setPage(1)
							}}
							className={`px-3 py-1.5 ${format === f ? 'bg-[var(--wc-basil)] text-[var(--wc-bg)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'}`}
						>
							{t(`admin.comments.format.${f}`)}
						</button>
					))}
				</div>
				<label className="flex cursor-pointer items-center gap-2 text-[var(--wc-text)]">
					<input
						type="checkbox"
						checked={reportedOnly}
						onChange={(e) => {
							setReportedOnly(e.target.checked)
							setPage(1)
						}}
					/>
					{t('admin.comments.reportedOnly')}
				</label>
				<label className="flex cursor-pointer items-center gap-2 text-[var(--wc-text)]">
					<input
						type="checkbox"
						checked={editedOnly}
						onChange={(e) => {
							setEditedOnly(e.target.checked)
							setPage(1)
						}}
					/>
					{t('admin.comments.editedOnly')}
				</label>
			</div>

			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{!data && (
				<div className="mt-4">
					<ListSkeleton />
				</div>
			)}
			{data && visible.length === 0 && !error && <p className="mt-6 text-[var(--wc-text-muted)]">{t('admin.comments.empty')}</p>}

			<ul className="mt-4 space-y-3">{visible.map((c) => renderComment(c))}</ul>

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}

			{purging && (
				<ConfirmDialog
					title={t('admin.comments.purgeTitle')}
					confirmLabel={t('admin.comments.purge')}
					danger
					onConfirm={() => hardDelete(purging.comment, purging.prune)}
					onClose={() => setPurging(null)}
				>
					<p>{purging.prune ? t('admin.comments.purgeWithReplies') : t('admin.comments.purgeText')}</p>
					<p className="italic text-[var(--wc-text-muted)]">“{purging.comment.content.slice(0, 160)}”</p>
				</ConfirmDialog>
			)}
		</div>
	)
}

export default AdminComments
