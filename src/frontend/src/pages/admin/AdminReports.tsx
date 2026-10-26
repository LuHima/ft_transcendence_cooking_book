import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage, qs, toPage } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import Pagination from '../../components/Pagination'
import { ListSkeleton } from '../../components/Skeleton'
import type { ModerationAction, Paginated, Report, ReportStatus, ReportTarget } from '../../types/models'

const PAGE_SIZE = 10
const STATUSES: ReportStatus[] = ['open', 'resolved', 'dismissed']
const TARGETS: ReportTarget[] = ['recipe', 'comment', 'user']

const SELECT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'

// azioni disponibili per tipo di segnalazione
function actionsFor(r: Report): ModerationAction[] {
	const list: ModerationAction[] = ['dismiss', 'warn']
	if (r.target_type !== 'user') list.push('delete_content')
	list.push('ban')
	return list
}

function targetLink(r: Report): string | null {
	if (r.target_type === 'recipe') return `/recipes/${r.target_id}`
	if (r.target_type === 'user') return `/users/${r.target_id}`
	return r.target?.recipe_id ? `/recipes/${r.target.recipe_id}` : null
}

// coda delle segnalazioni, condivisa da moderatori e admin.
// NB: endpoint da esporre lato backend (guard: moderator | admin):
//   GET  /reports?status=&target_type=&page=&limit=   -> Paginated<Report>
//   POST /reports/:id/resolve { action: 'dismiss'|'warn'|'delete_content'|'ban', note? }
function AdminReports() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const [status, setStatus] = useState<ReportStatus>('open')
	const [target, setTarget] = useState<ReportTarget | ''>('')
	const [page, setPage] = useState(1)
	const [data, setData] = useState<Paginated<Report> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [reload, setReload] = useState(0)
	const [resolving, setResolving] = useState<Report | null>(null)

	useEffect(() => {
		let cancelled = false
		api
			.get<unknown>(`/reports${qs({ status, target_type: target, page, limit: PAGE_SIZE })}`)
			.then((res) => {
				if (cancelled) return
				setData(toPage<Report>(res, PAGE_SIZE))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setData(toPage<Report>([], PAGE_SIZE))
				setError(getErrorMessage(err, t('moderation.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [status, target, page, reload, t])

	function changeFilter(fn: () => void) {
		fn()
		setPage(1)
		setData(null)
	}

	return (
		<div>
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex gap-1" role="tablist" aria-label={t('moderation.status')}>
					{STATUSES.map((s) => (
						<button
							key={s}
							role="tab"
							aria-selected={status === s}
							onClick={() => changeFilter(() => setStatus(s))}
							className={`rounded-full px-3 py-1 text-sm ${
								status === s
									? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]'
									: 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'
							}`}
						>
							{t(`moderation.statuses.${s}`)}
						</button>
					))}
				</div>
				<select
					value={target}
					aria-label={t('moderation.type')}
					onChange={(e) => changeFilter(() => setTarget(e.target.value as ReportTarget | ''))}
					className={SELECT}
				>
					<option value="">{t('moderation.allTypes')}</option>
					{TARGETS.map((x) => (
						<option key={x} value={x}>
							{t(`moderation.targets.${x}`)}
						</option>
					))}
				</select>
			</div>

			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{!data && <div className="mt-4"><ListSkeleton /></div>}
			{data && data.items.length === 0 && !error && (
				<p className="mt-6 text-[var(--wc-text-muted)]">{t('moderation.empty')}</p>
			)}

			<ul className="mt-4 space-y-3">
				{data?.items.map((r) => {
					const link = targetLink(r)
					return (
						<li key={r.id} className="rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4">
							<div className="flex flex-wrap items-center gap-2 text-xs">
								<span className="rounded-full bg-[var(--wc-surface-raised)] px-2 py-0.5 uppercase text-[var(--wc-saffron)]">
									{t(`moderation.targets.${r.target_type}`)}
								</span>
								<span className="rounded-full border border-[var(--wc-border)] px-2 py-0.5 text-[var(--wc-text)]">
									{t(`report.reasons.${r.reason}`)}
								</span>
								<span className="text-[var(--wc-text-muted)]">
									{t('moderation.reportedBy', { name: r.reporter?.username ?? '—' })} ·{' '}
									{new Date(r.created_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })}
								</span>
							</div>

							<p className="mt-2 break-words text-sm text-[var(--wc-text)]">
								{link ? (
									<Link to={link} className="font-medium hover:text-[var(--wc-saffron)] hover:underline">
										{r.target?.label ?? `#${r.target_id}`}
									</Link>
								) : (
									<span className="font-medium">{r.target?.label ?? `#${r.target_id}`}</span>
								)}
								{r.target?.owner && (
									<span className="text-[var(--wc-text-muted)]">
										{' '}
										· {t('moderation.owner')}{' '}
										<Link to={`/users/${r.target.owner.id}`} className="hover:text-[var(--wc-saffron)] hover:underline">
											{r.target.owner.username}
										</Link>
									</span>
								)}
							</p>
							{r.details && (
								<p className="mt-1 whitespace-pre-line break-words text-sm italic text-[var(--wc-text-muted)]">
									“{r.details}”
								</p>
							)}

							{r.status === 'open' ? (
								<div className="mt-3">
									<button
										onClick={() => setResolving(r)}
										className="rounded-full bg-[var(--wc-basil)] px-4 py-1.5 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
									>
										{t('moderation.handle')}
									</button>
								</div>
							) : (
								<p className="mt-2 text-xs text-[var(--wc-text-muted)]">
									{r.resolution ? t(`moderation.actions.${r.resolution}`) : t(`moderation.statuses.${r.status}`)}
									{r.resolved_by && ` · ${r.resolved_by.username}`}
								</p>
							)}
						</li>
					)
				})}
			</ul>

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}

			{resolving && (
				<ResolveDialog
					report={resolving}
					onClose={() => setResolving(null)}
					onDone={() => {
						setResolving(null)
						toast.success(t('moderation.done'))
						setReload((n) => n + 1)
					}}
				/>
			)}
		</div>
	)
}

function ResolveDialog({ report, onClose, onDone }: { report: Report; onClose: () => void; onDone: () => void }) {
	const { t } = useTranslation()
	const toast = useToast()
	const actions = actionsFor(report)
	const [action, setAction] = useState<ModerationAction>('dismiss')
	const [note, setNote] = useState('')
	const [submitting, setSubmitting] = useState(false)

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (action === 'ban' && !confirm(t('moderation.confirmBan', { name: report.target?.owner?.username ?? '' }))) return
		if (action === 'delete_content' && !confirm(t('moderation.confirmDelete'))) return
		setSubmitting(true)
		try {
			await api.post(`/reports/${report.id}/resolve`, { action, ...(note.trim() ? { note: note.trim() } : {}) })
			onDone()
		} catch (err) {
			toast.error(getErrorMessage(err, t('moderation.actionError')))
			setSubmitting(false)
		}
	}

	return (
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
			role="dialog"
			aria-modal="true"
			aria-label={t('moderation.handle')}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onClose()
			}}
		>
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6"
			>
				<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{t('moderation.handle')}</h2>
				<fieldset className="space-y-2">
					<legend className="mb-1 text-sm text-[var(--wc-text-muted)]">{t('moderation.chooseAction')}</legend>
					{actions.map((a) => (
						<label key={a} className="flex cursor-pointer items-start gap-2 text-sm text-[var(--wc-text)]">
							<input type="radio" name="action" className="mt-1" checked={action === a} onChange={() => setAction(a)} />
							<span>
								<span className={`block font-medium ${a === 'ban' || a === 'delete_content' ? 'text-[var(--wc-paprika)]' : ''}`}>
									{t(`moderation.actions.${a}`)}
								</span>
								<span className="block text-xs text-[var(--wc-text-muted)]">{t(`moderation.actionHelp.${a}`)}</span>
							</span>
						</label>
					))}
				</fieldset>
				<div>
					<label htmlFor="mod-note" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						{action === 'warn' ? t('moderation.warnMessage') : t('moderation.note')}
					</label>
					<textarea
						id="mod-note"
						rows={3}
						maxLength={500}
						required={action === 'warn'}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-full border border-[var(--wc-border)] px-4 py-2 text-sm hover:border-[var(--wc-basil)]"
					>
						{t('common.cancel')}
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-full bg-[var(--wc-basil)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						{submitting ? t('common.sending') : t('moderation.confirm')}
					</button>
				</div>
			</form>
		</div>
	)
}

export default AdminReports
