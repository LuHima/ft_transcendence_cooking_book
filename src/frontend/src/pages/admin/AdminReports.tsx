import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage, qs, toPage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useLang } from '../../lib/useLang'
import { isAdmin } from '../../lib/permissions'
import Avatar from '../../components/Avatar'
import Pagination from '../../components/Pagination'
import { ListSkeleton } from '../../components/Skeleton'
import {
	REPORT_REASONS,
	type ModerationAction,
	type Paginated,
	type ReportItem,
	type ReportReason,
	type ReportStatus,
	type ReportSubject,
	type ReportUser,
	type UpdateReportDto,
} from '../../types/models'

const PAGE_SIZE = 10
const STATUSES: ReportStatus[] = ['pending', 'action_taken', 'dismissed']
const SUBJECTS: ReportSubject[] = ['recipe', 'comment', 'user']
const MAX_TEXT = 1000
// limite backend per i moderatori (MAX_MODERATOR_BAN_DAYS)
const MODERATOR_MAX_BAN_DAYS = 180
// durate predefinite usate dal backend se ban_duration_days non viene inviato (DEFAULT_BAN_DURATIONS)
const DEFAULT_BAN_DAYS: Record<ReportReason, number> = {
	spam_scam: 7,
	copyright_infringement: 14,
	impersonation_misinformation: 14,
	harassment_bullying: 30,
	sexual_content: 30,
	hate_speech: 30,
	violence_threats: 60,
	other: 7,
}

const SELECT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'
const FIELD =
	'w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]'

// azioni "punitive" disponibili per tipo di contenuto (dismiss è una scelta a parte)
function actionsFor(r: ReportItem): Exclude<ModerationAction, 'dismiss'>[] {
	return r.subject === 'user' ? ['warn', 'ban'] : ['warn', 'delete_content', 'ban']
}

// link al contenuto segnalato: per i commenti si apre la ricetta che li contiene (target.recipe_id)
function targetLink(r: ReportItem): string | null {
	if (r.subject === 'recipe') return `/recipes/${r.target?.recipe_id ?? r.target_id}`
	if (r.subject === 'user') return `/users/${r.target_id}`
	return r.target?.recipe_id ? `/recipes/${r.target.recipe_id}` : null
}

// utente con avatar e link al profilo (segnalatore / autore del contenuto)
function UserChip({ user, fallbackId }: { user?: ReportUser | null; fallbackId?: number }) {
	if (!user) return fallbackId != null ? <span className="text-[var(--wc-text-muted)]">#{fallbackId}</span> : <span>—</span>
	return (
		<Link to={`/users/${user.id}`} className="inline-flex items-center gap-1.5 hover:text-[var(--wc-saffron)]">
			<Avatar username={user.username} url={user.avatar_url} className="h-5 w-5 text-[10px]" />
			<span className="truncate">{user.username}</span>
		</Link>
	)
}

// coda delle segnalazioni, condivisa da moderatori e admin:
//   GET   /api/reports?page=&limit=&status=&subject=&lang=  -> PaginatedReportsResponseDto
//         (reporter e target idratati; target.label localizzata in base a lang)
//   PATCH /api/reports/:id                             (UpdateReportDto)
function AdminReports() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const [status, setStatus] = useState<ReportStatus>('pending')
	const [subject, setSubject] = useState<ReportSubject | ''>('')
	const [page, setPage] = useState(1)
	const [data, setData] = useState<Paginated<ReportItem> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [reload, setReload] = useState(0)
	const [resolving, setResolving] = useState<ReportItem | null>(null)

	useEffect(() => {
		let cancelled = false
		api
			.get<unknown>(`/reports${qs({ page, limit: PAGE_SIZE, status, subject, lang })}`)
			.then((res) => {
				if (cancelled) return
				setData(toPage<ReportItem>(res, PAGE_SIZE))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setData(toPage<ReportItem>([], PAGE_SIZE))
				setError(getErrorMessage(err, t('moderation.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [status, subject, page, lang, reload, t])

	function changeFilter(fn: () => void) {
		fn()
		setPage(1)
		setData(null)
	}

	const fmtDate = (iso: string | null) =>
		iso ? new Date(iso).toLocaleString(lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

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
					value={subject}
					aria-label={t('moderation.type')}
					onChange={(e) => changeFilter(() => setSubject(e.target.value as ReportSubject | ''))}
					className={SELECT}
				>
					<option value="">{t('moderation.allTypes')}</option>
					{SUBJECTS.map((x) => (
						<option key={x} value={x}>
							{t(`moderation.targets.${x}`)}
						</option>
					))}
				</select>
			</div>

			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{!data && (
				<div className="mt-4">
					<ListSkeleton />
				</div>
			)}
			{data && data.items.length === 0 && !error && <p className="mt-6 text-[var(--wc-text-muted)]">{t('moderation.empty')}</p>}

			{data && data.items.length > 0 && (
				<div className="mt-4 overflow-x-auto rounded-2xl border border-[var(--wc-border)]">
					<table className="w-full min-w-[900px] border-collapse text-sm">
						<thead>
							<tr className="bg-[var(--wc-surface)] text-left text-[var(--wc-text-muted)]">
								<th className="p-3">#</th>
								<th className="p-3">{t('moderation.columns.target')}</th>
								<th className="p-3">{t('moderation.columns.reason')}</th>
								<th className="p-3">{t('moderation.columns.reporter')}</th>
								<th className="p-3">{t('moderation.columns.created')}</th>
								<th className="p-3">{t('moderation.columns.resolution')}</th>
								<th className="p-3 text-right">{t('admin.users.actions')}</th>
							</tr>
						</thead>
						<tbody>
							{data.items.map((r) => {
								const link = targetLink(r)
								const targetLabel = r.target?.label || `#${r.target_id}`
								return (
									<tr key={r.id} className="border-t border-[var(--wc-border)] align-top">
										<td className="p-3 text-[var(--wc-text-muted)]">{r.id}</td>
										<td className="max-w-xs p-3">
											<span className="mb-1 inline-block rounded-full bg-[var(--wc-surface-raised)] px-2 py-0.5 text-[10px] uppercase text-[var(--wc-saffron)]">
												{t(`moderation.targets.${r.subject}`)}
											</span>
											<span className="block break-words">
												{link ? (
													<Link to={link} className="font-medium hover:text-[var(--wc-saffron)] hover:underline">
														{r.subject === 'comment' ? `“${targetLabel}”` : targetLabel}
													</Link>
												) : (
													<span className="font-medium">{targetLabel}</span>
												)}
											</span>
											{r.target?.owner && r.subject !== 'user' && (
												<span className="mt-1 flex items-center gap-1 text-xs text-[var(--wc-text-muted)]">
													{t('moderation.owner')}
													<UserChip user={r.target.owner} />
												</span>
											)}
											{r.previous_bans_count != null && r.previous_bans_count > 0 && (
												<span className="mt-1 block text-xs text-[var(--wc-paprika)]">
													{t('moderation.previousBans', { count: r.previous_bans_count })}
												</span>
											)}
										</td>
										<td className="max-w-xs p-3">
											<span className="inline-block rounded-full border border-[var(--wc-border)] px-2 py-0.5 text-xs">
												{t(`report.reasons.${r.reason}`)}
											</span>
											{r.description && (
												<p className="mt-1 whitespace-pre-line break-words text-xs italic text-[var(--wc-text-muted)]">“{r.description}”</p>
											)}
										</td>
										<td className="p-3">
											<UserChip user={r.reporter} fallbackId={r.reporter_id} />
										</td>
										<td className="whitespace-nowrap p-3 text-xs text-[var(--wc-text-muted)]">{fmtDate(r.created_at)}</td>
										<td className="max-w-xs p-3 text-xs">
											{r.status === 'pending' ? (
												<span className="text-[var(--wc-saffron)]">{t('moderation.statuses.pending')}</span>
											) : (
												<div className="space-y-1">
													<p className="font-medium text-[var(--wc-text)]">
														{t(`moderation.statuses.${r.status}`)}
														{r.resolution_reason && ` · ${t(`report.reasons.${r.resolution_reason}`)}`}
													</p>
													{r.resolution_description && (
														<p className="break-words text-[var(--wc-text)]">
															<span className="text-[var(--wc-text-muted)]">{t('moderation.userMessage')}: </span>
															{r.resolution_description}
														</p>
													)}
													{r.resolution_notes && (
														<p className="break-words text-[var(--wc-text-muted)]">
															{t('moderation.internalNotes')}: {r.resolution_notes}
														</p>
													)}
													<p className="text-[var(--wc-text-muted)]">
														{r.resolved_by_id != null && (
															<>
																{t('moderation.resolvedBy')}{' '}
																<Link to={`/users/${r.resolved_by_id}`} className="hover:underline">
																	#{r.resolved_by_id}
																</Link>{' '}
																·{' '}
															</>
														)}
														{fmtDate(r.resolved_at)}
													</p>
												</div>
											)}
										</td>
										<td className="p-3 text-right">
											{r.status === 'pending' && (
												<button
													onClick={() => setResolving(r)}
													className="rounded-full bg-[var(--wc-basil)] px-4 py-1.5 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
												>
													{t('moderation.handle')}
												</button>
											)}
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

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

function ResolveDialog({ report, onClose, onDone }: { report: ReportItem; onClose: () => void; onDone: () => void }) {
	const { t } = useTranslation()
	const toast = useToast()
	const { user } = useAuth()
	const admin = isAdmin(user)
	const available = actionsFor(report)

	const [mode, setMode] = useState<'dismiss' | 'action'>('action')
	const [actions, setActions] = useState<Exclude<ModerationAction, 'dismiss'>[]>([])
	const [resolutionReason, setResolutionReason] = useState<ReportReason>(report.reason)
	const [resolutionDescription, setResolutionDescription] = useState('')
	const [resolutionNotes, setResolutionNotes] = useState('')
	const [banDays, setBanDays] = useState('')
	const [isPermanent, setIsPermanent] = useState(false)
	const [submitting, setSubmitting] = useState(false)
	const [formError, setFormError] = useState<string | null>(null)

	const banSelected = mode === 'action' && actions.includes('ban')
	const maxDays = admin ? undefined : MODERATOR_MAX_BAN_DAYS

	function toggleAction(a: Exclude<ModerationAction, 'dismiss'>) {
		setActions((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setFormError(null)

		let body: UpdateReportDto
		if (mode === 'dismiss') {
			body = {
				status: 'dismissed',
				actions: ['dismiss'],
				...(resolutionNotes.trim() ? { resolution_notes: resolutionNotes.trim() } : {}),
			}
		} else {
			if (actions.length === 0) return setFormError(t('moderation.errors.noAction'))
			const days = banDays.trim() ? Number(banDays) : undefined
			if (banSelected && !isPermanent && days !== undefined) {
				if (!Number.isInteger(days) || days < 1) return setFormError(t('moderation.errors.banDays'))
				if (maxDays && days > maxDays) return setFormError(t('moderation.errors.banCap', { max: maxDays }))
			}
			const owner = report.target?.owner?.username
			if (actions.includes('ban') && !confirm(owner ? t('moderation.confirmBanName', { name: owner }) : t('moderation.confirmBan'))) return
			if (actions.includes('delete_content') && !confirm(t('moderation.confirmDelete'))) return
			body = {
				status: 'action_taken',
				actions,
				resolution_reason: resolutionReason,
				...(resolutionDescription.trim() ? { resolution_description: resolutionDescription.trim() } : {}),
				...(resolutionNotes.trim() ? { resolution_notes: resolutionNotes.trim() } : {}),
				...(banSelected && admin && isPermanent ? { is_permanent: true } : {}),
				...(banSelected && !isPermanent && days !== undefined ? { ban_duration_days: days } : {}),
			}
		}

		setSubmitting(true)
		try {
			await api.patch(`/reports/${report.id}`, body)
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
				className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6"
			>
				<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{t('moderation.handle')}</h2>
				<p className="text-xs text-[var(--wc-text-muted)]">
					{t(`moderation.targets.${report.subject}`)}: {report.target?.label ?? `#${report.target_id}`}
					{report.target?.owner && ` · ${t('moderation.owner')} ${report.target.owner.username}`} · {t(`report.reasons.${report.reason}`)}
				</p>

				<fieldset className="flex gap-4 text-sm">
					<legend className="sr-only">{t('moderation.chooseAction')}</legend>
					<label className="flex cursor-pointer items-center gap-2">
						<input type="radio" name="mode" checked={mode === 'action'} onChange={() => setMode('action')} />
						{t('moderation.takeAction')}
					</label>
					<label className="flex cursor-pointer items-center gap-2">
						<input type="radio" name="mode" checked={mode === 'dismiss'} onChange={() => setMode('dismiss')} />
						{t('moderation.actions.dismiss')}
					</label>
				</fieldset>

				{mode === 'action' && (
					<>
						<fieldset className="space-y-2">
							<legend className="mb-1 text-sm text-[var(--wc-text-muted)]">{t('moderation.chooseAction')}</legend>
							{available.map((a) => (
								<label key={a} className="flex cursor-pointer items-start gap-2 text-sm text-[var(--wc-text)]">
									<input type="checkbox" className="mt-1" checked={actions.includes(a)} onChange={() => toggleAction(a)} />
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
							<label htmlFor="mod-reason" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
								{t('moderation.resolutionReason')} *
							</label>
							<select
								id="mod-reason"
								required
								value={resolutionReason}
								onChange={(e) => setResolutionReason(e.target.value as ReportReason)}
								className={`${SELECT} w-full`}
							>
								{REPORT_REASONS.map((r) => (
									<option key={r} value={r}>
										{t(`report.reasons.${r}`)}
									</option>
								))}
							</select>
						</div>

						{banSelected && (
							<div className="space-y-2 rounded-xl border border-[var(--wc-paprika)] p-3">
								<label htmlFor="mod-ban-days" className="block text-sm text-[var(--wc-text-muted)]">
									{t('moderation.banDuration')}
								</label>
								<input
									id="mod-ban-days"
									type="number"
									min={1}
									max={maxDays}
									step={1}
									disabled={isPermanent}
									value={banDays}
									placeholder={String(DEFAULT_BAN_DAYS[resolutionReason])}
									onChange={(e) => setBanDays(e.target.value)}
									className={`${FIELD} disabled:opacity-50`}
								/>
								<p className="text-xs text-[var(--wc-text-muted)]">
									{t('moderation.banDurationHelp', { days: DEFAULT_BAN_DAYS[resolutionReason] })}
									{!admin && ` ${t('moderation.banCapHelp', { max: MODERATOR_MAX_BAN_DAYS })}`}
								</p>
								{admin && (
									<label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--wc-paprika)]">
										<input type="checkbox" checked={isPermanent} onChange={(e) => setIsPermanent(e.target.checked)} />
										{t('moderation.permanentBan')}
									</label>
								)}
							</div>
						)}

						<div>
							<label htmlFor="mod-user-msg" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
								{t('moderation.userMessage')}
							</label>
							<textarea
								id="mod-user-msg"
								rows={3}
								maxLength={MAX_TEXT}
								value={resolutionDescription}
								onChange={(e) => setResolutionDescription(e.target.value)}
								className={FIELD}
							/>
							<p className="mt-1 text-xs text-[var(--wc-text-muted)]">{t('moderation.userMessageHelp')}</p>
						</div>
					</>
				)}

				<div>
					<label htmlFor="mod-note" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						{t('moderation.note')}
					</label>
					<textarea
						id="mod-note"
						rows={2}
						maxLength={MAX_TEXT}
						value={resolutionNotes}
						onChange={(e) => setResolutionNotes(e.target.value)}
						className={FIELD}
					/>
				</div>

				{formError && (
					<p role="alert" className="text-sm text-[var(--wc-paprika)]">
						{formError}
					</p>
				)}

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
