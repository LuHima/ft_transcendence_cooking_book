import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, ApiError, getErrorMessage, qs, toPage } from '../../api/client'
import { useAuth } from '../../context/auth'
import { useToast } from '../../context/toast'
import { useLang } from '../../lib/useLang'
import { isAdmin } from '../../lib/permissions'
import { DEFAULT_BAN_DAYS, MODERATION_TEXT_MAX, MODERATOR_MAX_BAN_DAYS } from '../../lib/moderation'
import { useDialogDismiss } from '../../lib/useDialogDismiss'
import { useScrollIntoViewOnChange } from '../../lib/useScrollIntoViewOnChange'
import Avatar from '../../components/Avatar'
import BanHistoryDrawer from '../../components/BanHistoryDrawer'
import ConfirmDialog from '../../components/ConfirmDialog'
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
	type UserRef,
} from '../../types/models'

const PAGE_SIZE = 10
type StatusTab = ReportStatus | 'all'
const STATUSES: StatusTab[] = ['pending', 'action_taken', 'dismissed', 'all']
const SUBJECTS: ReportSubject[] = ['recipe', 'comment', 'user']

const SELECT =
	'rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]'
const FIELD =
	'w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]'

// avviso e ban si escludono a vicenda; delete_content si può abbinare a uno dei due
const EXCLUSIVE: Partial<Record<ModerationAction, ModerationAction>> = { warn: 'ban', ban: 'warn' }

const positiveInt = (raw: string | null) => (raw && /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : undefined)

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

// utente sanzionabile della segnalazione: l'utente stesso o il proprietario del contenuto
function sanctionedUser(r: ReportItem): { id: number; username: string } | null {
	if (r.subject === 'user') return { id: r.target_id, username: r.target?.label || `#${r.target_id}` }
	return r.target?.owner ? { id: r.target.owner.id, username: r.target.owner.username } : null
}

// utente con avatar e link al profilo (segnalatore / autore del contenuto / staff)
function UserChip({ user, fallbackId }: { user?: ReportUser | UserRef | null; fallbackId?: number | null }) {
	if (!user) return fallbackId != null ? <span className="text-[var(--wc-text-muted)]">#{fallbackId}</span> : <span>—</span>
	return (
		<Link to={`/users/${user.id}`} className="inline-flex items-center gap-1.5 hover:text-[var(--wc-saffron)]">
			<Avatar username={user.username} url={user.avatar_url} className="h-5 w-5 text-[10px]" />
			<span className="truncate">{user.username}</span>
		</Link>
	)
}

interface ReportsResult {
	key: string
	data: Paginated<ReportItem> | null
	error: string | null
}

// coda delle segnalazioni, condivisa da moderatori e admin. Filtri nell'URL (deep link da altri pannelli):
//   ?status=pending|action_taken|dismissed|all &subject= &target_id= &report_id= &resolve=1
//   GET   /api/reports?page=&limit=&status=&subject=&target_id=&lang=  -> PaginatedReportsResponseDto
//         (reporter, target e resolved_by idratati; target.label localizzata in base a lang;
//          target_id richiede subject, altrimenti 400)
//   GET   /api/reports/:id?lang=                                    (link dallo storico ban, risoluzione in un clic)
//   PATCH /api/reports/:id                                          (UpdateReportDto)
function AdminReports() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const [params, setParams] = useSearchParams()
	const statusParam = params.get('status')
	const status: StatusTab = (STATUSES as string[]).includes(statusParam ?? '') ? (statusParam as StatusTab) : 'pending'
	const subjectParam = params.get('subject')
	const subject: ReportSubject | '' = (SUBJECTS as string[]).includes(subjectParam ?? '') ? (subjectParam as ReportSubject) : ''
	const targetId = positiveInt(params.get('target_id'))
	const reportId = positiveInt(params.get('report_id'))
	// deep link "Gestisci": apre subito il dialogo di risoluzione della segnalazione report_id
	const autoResolve = params.get('resolve') === '1'

	const [page, setPage] = useState(1)
	const [result, setResult] = useState<ReportsResult | null>(null)
	const [reload, setReload] = useState(0)
	const [resolving, setResolving] = useState<ReportItem | null>(null)
	const [history, setHistory] = useState<{ id: number; username: string } | null>(null)
	const listTopRef = useRef<HTMLDivElement>(null)
	useScrollIntoViewOnChange(page, listTopRef)

	// filtri cambiati (anche da un deep link): si riparte dalla prima pagina
	const filterKey = [status, subject, targetId, reportId].join('|')
	const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
	if (filterKey !== prevFilterKey) {
		setPrevFilterKey(filterKey)
		setPage(1)
	}
	const requestKey = [filterKey, page, lang, reload].join('|')

	useEffect(() => {
		let cancelled = false
		const done = (r: Omit<ReportsResult, 'key'>) => {
			if (!cancelled) setResult({ key: requestKey, ...r })
		}

		async function load() {
			// una sola segnalazione (storico delle sanzioni, "Gestisci" da ricette e commenti)
			if (reportId) {
				const one = await api.get<ReportItem>(`/reports/${reportId}${qs({ lang })}`)
				if (!cancelled && autoResolve && one?.status === 'pending') {
					setResolving(one)
					// one-shot: ricaricando la pagina il dialogo non si riapre
					setParams(
						(prev) => {
							const next = new URLSearchParams(prev)
							next.delete('resolve')
							return next
						},
						{ replace: true },
					)
				}
				return done({ data: toPage<ReportItem>(one ? [one] : [], PAGE_SIZE), error: null })
			}
			// target_id senza subject: il backend risponde 400 (ID ambigui tra ricette, commenti e utenti)
			if (targetId && !subject) return done({ data: null, error: t('moderation.targetNeedsSubject') })
			const res = await api.get<unknown>(
				`/reports${qs({ status: status === 'all' ? undefined : status, subject, target_id: targetId, lang, page, limit: PAGE_SIZE })}`,
			)
			return done({ data: toPage<ReportItem>(res, PAGE_SIZE), error: null })
		}

		load().catch((err) => {
			const notFound = reportId && err instanceof ApiError && err.status === 404
			done({ data: null, error: notFound ? t('moderation.reportNotFound', { id: reportId }) : getErrorMessage(err, t('moderation.loadError')) })
		})
		return () => {
			cancelled = true
		}
	}, [status, subject, targetId, reportId, autoResolve, page, lang, reload, requestKey, setParams, t])

	// risposta della richiesta corrente; durante un cambio pagina resta visibile la precedente, cambiando filtri no
	const current = result?.key === requestKey ? result : null
	const sameFilters = result?.key.startsWith(`${filterKey}|`) ?? false
	const shown = current ?? (sameFilters ? result : null)
	const data = shown?.data ?? null
	const error = current?.error ?? null
	const loading = current === null

	// aggiorna i filtri nell'URL (la scheda ?tab= resta)
	function updateFilters(patch: Record<string, string | null>) {
		const next = new URLSearchParams(params)
		for (const [k, v] of Object.entries(patch)) {
			if (v) next.set(k, v)
			else next.delete(k)
		}
		setParams(next)
	}

	const fmtDate = (iso: string | null) =>
		iso ? new Date(iso).toLocaleString(lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

	return (
		<div ref={listTopRef} className="scroll-mt-24">
			<div className="flex flex-wrap items-center gap-3">
				<div className="flex flex-wrap gap-1" role="tablist" aria-label={t('moderation.status')}>
					{STATUSES.map((s) => (
						<button
							key={s}
							role="tab"
							aria-selected={!reportId && status === s}
							onClick={() => updateFilters({ status: s === 'pending' ? null : s, report_id: null })}
							className={`rounded-full px-3 py-1 text-sm ${
								!reportId && status === s
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
					disabled={Boolean(reportId)}
					onChange={(e) => updateFilters({ subject: e.target.value || null, target_id: null, report_id: null })}
					className={`${SELECT} disabled:opacity-50`}
				>
					<option value="">{t('moderation.allTypes')}</option>
					{SUBJECTS.map((x) => (
						<option key={x} value={x}>
							{t(`moderation.targets.${x}`)}
						</option>
					))}
				</select>
				{/* filtro mirato attivo (deep link da ricette, commenti o storico ban) */}
				{(targetId || reportId) && (
					<span className="inline-flex items-center gap-2 rounded-full border border-[var(--wc-saffron)] px-3 py-1 text-sm text-[var(--wc-saffron)]">
						{reportId
							? t('moderation.filterReport', { id: reportId })
							: t('moderation.filterTarget', { target: subject ? t(`moderation.targets.${subject}`) : '', id: targetId })}
						<button
							type="button"
							onClick={() => updateFilters({ target_id: null, report_id: null })}
							aria-label={t('moderation.clearTargetFilter')}
							className="text-base leading-none hover:text-[var(--wc-text)]"
						>
							×
						</button>
					</span>
				)}
			</div>

			{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{loading && !data && (
				<div className="mt-4">
					<ListSkeleton />
				</div>
			)}
			{!loading && data && data.items.length === 0 && !error && <p className="mt-6 text-[var(--wc-text-muted)]">{t('moderation.empty')}</p>}

			{data && data.items.length > 0 && (
				<div className={`mt-4 overflow-x-auto rounded-2xl border border-[var(--wc-border)] transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
					<table className="w-full min-w-[900px] border-collapse text-sm">
						<thead>
							<tr className="bg-[var(--wc-surface)] text-left text-[var(--wc-text-muted)]">
								<th className="whitespace-nowrap p-3">#</th>
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
								const offender = sanctionedUser(r)
								return (
									<tr key={r.id} className="border-t border-[var(--wc-border)] align-top">
										<td className="whitespace-nowrap p-3 text-[var(--wc-text-muted)]">{r.id}</td>
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
											{/* precedenti dell'autore: avvisi e ban già ricevuti */}
											{((r.previous_warnings_count ?? 0) > 0 || (r.previous_bans_count ?? 0) > 0) && (
												<span className="mt-1 flex flex-wrap gap-1">
													{(r.previous_warnings_count ?? 0) > 0 && (
														<span className="rounded-full border border-[var(--wc-saffron)] px-2 py-0.5 text-[10px] text-[var(--wc-saffron)]">
															{t('moderation.previousWarnings', { count: r.previous_warnings_count })}
														</span>
													)}
													{(r.previous_bans_count ?? 0) > 0 && (
														<span className="rounded-full border border-[var(--wc-paprika)] px-2 py-0.5 text-[10px] text-[var(--wc-paprika)]">
															{t('moderation.previousBans', { count: r.previous_bans_count })}
														</span>
													)}
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
												<span className="whitespace-nowrap text-[var(--wc-saffron)]">{t('moderation.statuses.pending')}</span>
											) : (
												<div className="space-y-1">
													<p className="font-medium text-[var(--wc-text)]">
														{t(`moderation.statuses.${r.status}`)}
														{r.resolution_reason && ` · ${t(`report.reasons.${r.resolution_reason}`)}`}
													</p>
													{/* azioni eseguite alla risoluzione */}
													{r.actions && r.actions.some((a) => a !== 'dismiss') && (
														<p className="flex flex-wrap gap-1">
															{r.actions
																.filter((a) => a !== 'dismiss')
																.map((a) => (
																	<span key={a} className="rounded-full bg-[var(--wc-surface-raised)] px-2 py-0.5 text-[10px]">
																		{t(`moderation.actions.${a}`)}
																	</span>
																))}
														</p>
													)}
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
														{(r.resolved_by || r.resolved_by_id != null) && (
															<span className="inline-flex flex-wrap items-center gap-1">
																{t('moderation.resolvedBy')} <UserChip user={r.resolved_by} fallbackId={r.resolved_by_id} /> ·{' '}
															</span>
														)}
														{fmtDate(r.resolved_at)}
													</p>
												</div>
											)}
										</td>
										<td className="p-3">
											{/* colonna a larghezza fissa: i due pulsanti hanno la stessa larghezza */}
											<div className="ml-auto flex w-32 flex-col gap-2">
												{r.status === 'pending' && (
													<button
														onClick={() => setResolving(r)}
														className="w-full whitespace-nowrap rounded-full bg-[var(--wc-basil)] px-3 py-1.5 text-center text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
													>
														{t('moderation.handle')}
													</button>
												)}
												{/* storico sanzioni dell'utente coinvolto, anche sulle segnalazioni già chiuse */}
												{offender && (
													<button
														onClick={() => setHistory(offender)}
														className="w-full whitespace-nowrap rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-center text-sm hover:border-[var(--wc-saffron)]"
													>
														{t('admin.users.banHistory')}
													</button>
												)}
											</div>
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			{data && !reportId && (
				<Pagination page={page} totalPages={data.total_pages} hasPrev={data.has_prev_page} hasNext={data.has_next_page} onChange={setPage} />
			)}

			{resolving && (
				<ResolveDialog
					report={resolving}
					onClose={() => setResolving(null)}
					onShowHistory={setHistory}
					onDone={() => {
						setResolving(null)
						toast.success(t('moderation.done'))
						// ultima segnalazione della pagina risolta: si torna indietro invece di restare su una pagina vuota
						if (status === 'pending' && data && data.items.length === 1 && page > 1) setPage(page - 1)
						else setReload((n) => n + 1)
					}}
				/>
			)}
			{history && <BanHistoryDrawer user={history} onClose={() => setHistory(null)} />}
		</div>
	)
}

function ResolveDialog({
	report,
	onClose,
	onDone,
	onShowHistory,
}: {
	report: ReportItem
	onClose: () => void
	onDone: () => void
	onShowHistory: (user: { id: number; username: string }) => void
}) {
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
	// ban / rimozione contenuto: conferma con ConfirmDialog prima di inviare
	const [pendingBody, setPendingBody] = useState<UpdateReportDto | null>(null)
	const offender = sanctionedUser(report)

	useDialogDismiss(() => {
		if (!submitting) onClose()
	}, pendingBody === null)

	const banSelected = mode === 'action' && actions.includes('ban')
	const maxDays = admin ? undefined : MODERATOR_MAX_BAN_DAYS

	// scegliendo avviso si toglie il ban (e viceversa)
	function toggleAction(a: Exclude<ModerationAction, 'dismiss'>) {
		setActions((prev) => {
			if (prev.includes(a)) return prev.filter((x) => x !== a)
			const other = EXCLUSIVE[a]
			return [...prev.filter((x) => x !== other), a]
		})
	}
	// un'azione è bloccata se è già scelta quella incompatibile
	const isBlocked = (a: ModerationAction) => {
		const other = EXCLUSIVE[a]
		return other != null && (actions as ModerationAction[]).includes(other)
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
			body = {
				status: 'action_taken',
				actions,
				resolution_reason: resolutionReason,
				...(resolutionDescription.trim() ? { resolution_description: resolutionDescription.trim() } : {}),
				...(resolutionNotes.trim() ? { resolution_notes: resolutionNotes.trim() } : {}),
				...(banSelected && admin && isPermanent ? { permanent: true } : {}),
				...(banSelected && !isPermanent && days !== undefined ? { ban_duration_days: days } : {}),
			}
		}

		// azioni irreversibili o pesanti: prima la conferma
		if (body.actions.includes('ban') || body.actions.includes('delete_content')) {
			setPendingBody(body)
			return
		}
		await send(body)
	}

	async function send(body: UpdateReportDto) {
		setSubmitting(true)
		try {
			await api.patch(`/reports/${report.id}`, body)
			onDone()
		} catch (err) {
			toast.error(getErrorMessage(err, t('moderation.actionError')))
			setSubmitting(false)
		}
	}

	const owner = report.target?.owner?.username ?? (report.subject === 'user' ? report.target?.label : undefined)

	return (
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
			role="dialog"
			aria-modal="true"
			aria-label={t('moderation.handle')}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget && !submitting) onClose()
			}}
		>
			<form
				onSubmit={handleSubmit}
				className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6"
			>
				<div className="flex items-start justify-between gap-3">
					<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{t('moderation.handle')}</h2>
					<button type="button" onClick={onClose} aria-label={t('common.close')} className="text-xl text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]">
						×
					</button>
				</div>
				<p className="text-xs text-[var(--wc-text-muted)]">
					{t(`moderation.targets.${report.subject}`)}: {report.target?.label ?? `#${report.target_id}`}
					{report.target?.owner && ` · ${t('moderation.owner')} ${report.target.owner.username}`} · {t(`report.reasons.${report.reason}`)}
				</p>
				{offender && (
					<button
						type="button"
						onClick={() => onShowHistory(offender)}
						className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-xs hover:border-[var(--wc-saffron)]"
					>
						{t('admin.users.banHistory')}
						{(report.previous_bans_count ?? 0) > 0 && ` · ${t('moderation.previousBans', { count: report.previous_bans_count })}`}
						{(report.previous_warnings_count ?? 0) > 0 && ` · ${t('moderation.previousWarnings', { count: report.previous_warnings_count })}`}
					</button>
				)}

				<fieldset className="flex gap-4 text-sm">
					<legend className="sr-only">{t('moderation.chooseAction')}</legend>
					<label className="flex cursor-pointer items-center gap-2">
						<input type="radio" name="mode" checked={mode === 'action'} onChange={() => setMode('action')} />
						{t('moderation.takeAction')}
					</label>
					<label className="flex cursor-pointer items-center gap-2">
						<input
							type="radio"
							name="mode"
							checked={mode === 'dismiss'}
							onChange={() => {
								// archiviando, le azioni punitive spariscono e non vengono inviate
								setMode('dismiss')
								setActions([])
							}}
						/>
						{t('moderation.actions.dismiss')}
					</label>
				</fieldset>

				{mode === 'action' && (
					<>
						<fieldset className="space-y-2">
							<legend className="mb-1 text-sm text-[var(--wc-text-muted)]">{t('moderation.chooseAction')}</legend>
							{available.map((a) => (
								<label
									key={a}
									className={`flex items-start gap-2 text-sm text-[var(--wc-text)] ${isBlocked(a) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
								>
									<input
										type="checkbox"
										className="mt-1"
										checked={actions.includes(a)}
										disabled={isBlocked(a)}
										onChange={() => toggleAction(a)}
									/>
									<span>
										<span className={`block font-medium ${a === 'ban' || a === 'delete_content' ? 'text-[var(--wc-paprika)]' : ''}`}>
											{t(`moderation.actions.${a}`)}
										</span>
										<span className="block text-xs text-[var(--wc-text-muted)]">
											{isBlocked(a) ? t('moderation.exclusiveHelp') : t(`moderation.actionHelp.${a}`)}
										</span>
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
								maxLength={MODERATION_TEXT_MAX}
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
						maxLength={MODERATION_TEXT_MAX}
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
			{pendingBody && (
				<ConfirmDialog
					title={t('moderation.confirmTitle')}
					confirmLabel={t('moderation.confirm')}
					danger
					onConfirm={async () => {
						const body = pendingBody
						setPendingBody(null)
						await send(body)
					}}
					onClose={() => setPendingBody(null)}
				>
					{pendingBody.actions.includes('ban') && (
						<p>{owner ? t('moderation.confirmBanName', { name: owner }) : t('moderation.confirmBan')}</p>
					)}
					{pendingBody.actions.includes('delete_content') && <p>{t('moderation.confirmDelete')}</p>}
				</ConfirmDialog>
			)}
		</div>
	)
}

export default AdminReports
