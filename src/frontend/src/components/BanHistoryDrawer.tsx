import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, ApiError, getErrorMessage, qs, toPage } from '../api/client'
import { useLang } from '../lib/useLang'
import { useDialogDismiss } from '../lib/useDialogDismiss'
import { reportsHref, useStaffBasePath } from '../lib/staffLinks'
import Avatar from './Avatar'
import Pagination from './Pagination'
import { ListSkeleton } from './Skeleton'
import type { BanHistoryItem, PaginatedBanHistoryResponseDto, SortOrder, UserRef } from '../types/models'

const PAGE_SIZE = 10

interface BanHistoryDrawerProps {
	// Sanctioned user (id required, username for the title)
	user: { id: number; username: string }
	onClose: () => void
}

// Staff user: hydrated summary when the backend provides it (#207), otherwise the raw ID
function StaffName({ actor, fallbackId }: { actor?: UserRef | null; fallbackId: number | null }) {
	if (actor) {
		return (
			<Link to={`/users/${actor.id}`} className="inline-flex items-center gap-1 hover:text-[var(--wc-saffron)] hover:underline">
				<Avatar username={actor.username} url={actor.avatar_url} className="h-4 w-4 text-[8px]" />
				{actor.username}
			</Link>
		)
	}
	if (fallbackId == null) return <>—</>
	return (
		<Link to={`/users/${fallbackId}`} className="hover:underline">
			#{fallbackId}
		</Link>
	)
}

// Sanction history of a user, shared by /admin and /moderation (side panel):
//   GET /admin/users/:id/ban-history?page=&limit=&sort_order=asc|desc → PaginatedBanHistoryResponseDto
// Moderators need backend #207 (read access for the moderator role).
function BanHistoryDrawer({ user, onClose }: BanHistoryDrawerProps) {
	const { t } = useTranslation()
	const lang = useLang()
	const base = useStaffBasePath()
	const [page, setPage] = useState(1)
	// backend default: newest first
	const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
	// response tagged with its request: a different key means loading
	const [result, setResult] = useState<{ key: string; data: PaginatedBanHistoryResponseDto | null; error: string | null } | null>(null)
	const requestKey = `${user.id}|${page}|${sortOrder}`

	useDialogDismiss(onClose)

	useEffect(() => {
		let cancelled = false
		api
			.get<unknown>(`/admin/users/${user.id}/ban-history${qs({ page, limit: PAGE_SIZE, sort_order: sortOrder })}`)
			.then((res) => {
				if (!cancelled) setResult({ key: requestKey, data: toPage<BanHistoryItem>(res, PAGE_SIZE), error: null })
			})
			.catch((err) => {
				if (cancelled) return
				// 403: per ora lo storico è solo per gli admin (accesso dei moderatori: backend #207)
				const forbidden = err instanceof ApiError && err.status === 403
				setResult({ key: requestKey, data: null, error: forbidden ? t('admin.users.banHistoryForbidden') : getErrorMessage(err, t('admin.users.banHistoryError')) })
			})
		return () => {
			cancelled = true
		}
	}, [user.id, page, sortOrder, requestKey, t])

	const current = result?.key === requestKey ? result : null
	const data = current?.data ?? null
	const items = current ? (data?.items ?? []) : null
	const error = current?.error ?? null

	const fmt = (iso: string | null) =>
		iso ? new Date(iso).toLocaleString(lang, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
	const title = t('admin.users.banHistoryTitle', { name: user.username })

	return (
		<div
			className="fixed inset-0 z-[96] flex justify-end bg-black/60"
			role="dialog"
			aria-modal="true"
			aria-label={title}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
		>
			{/* side panel (slide-over) */}
			<div className="h-full w-full max-w-lg overflow-y-auto border-l border-[var(--wc-border)] bg-[var(--wc-bg)] p-6">
				<div className="flex items-start justify-between gap-3">
					<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{title}</h2>
					<button autoFocus onClick={onClose} aria-label={t('common.close')} className="text-xl text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]">
						×
					</button>
				</div>

				<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--wc-text-muted)]">
					{data && <span>{t('admin.users.banHistoryCount', { count: data.total })}</span>}
					<label className="ml-auto flex items-center gap-2">
						{t('search.sortBy')}
						<select
							value={sortOrder}
							onChange={(e) => {
								setSortOrder(e.target.value as SortOrder)
								setPage(1)
							}}
							className="rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-1 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-basil)]"
						>
							<option value="desc">{t('admin.users.banHistorySort.desc')}</option>
							<option value="asc">{t('admin.users.banHistorySort.asc')}</option>
						</select>
					</label>
				</div>

				{error && <p className="mt-4 text-sm text-[var(--wc-paprika)]">{error}</p>}
				{!items && (
					<div className="mt-4">
						<ListSkeleton rows={3} />
					</div>
				)}
				{items && items.length === 0 && !error && <p className="mt-4 text-sm text-[var(--wc-text-muted)]">{t('admin.users.banHistoryEmpty')}</p>}

				<ol className="mt-4 space-y-3">
					{items?.map((b) => (
						<li key={b.id} className="rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-4 text-sm">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span className="flex flex-wrap items-center gap-1.5">
									{b.action && b.action !== 'ban' && (
										<span className="rounded-full bg-[var(--wc-surface-raised)] px-2 py-0.5 text-[10px] uppercase">
											{t(`moderation.actions.${b.action}`)}
										</span>
									)}
									<span className="rounded-full border border-[var(--wc-paprika)] px-2 py-0.5 text-xs text-[var(--wc-paprika)]">
										{t(`report.reasons.${b.reason}`)}
									</span>
								</span>
								<span className="text-xs font-medium text-[var(--wc-text)]">
									{b.is_permanent ? t('admin.users.bannedPermanent') : t('admin.users.banDays', { count: b.duration_days ?? 0 })}
								</span>
							</div>
							<dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
								<dt className="text-[var(--wc-text-muted)]">{t('admin.users.banStart')}</dt>
								<dd>{fmt(b.banned_at)}</dd>
								<dt className="text-[var(--wc-text-muted)]">{t('admin.users.banEnd')}</dt>
								<dd>{b.is_permanent ? '∞' : fmt(b.expires_at)}</dd>
								{b.unbanned_at && (
									<>
										<dt className="text-[var(--wc-text-muted)]">{t('admin.users.unbannedAt')}</dt>
										<dd>
											{fmt(b.unbanned_at)}
											{(b.unbanned_by || b.unbanned_by_id != null) && (
												<>
													{' · '}
													<StaffName actor={b.unbanned_by} fallbackId={b.unbanned_by_id} />
												</>
											)}
										</dd>
									</>
								)}
								<dt className="text-[var(--wc-text-muted)]">{t('admin.users.bannedBy')}</dt>
								<dd>
									<StaffName actor={b.banned_by} fallbackId={b.banned_by_id} />
									{b.report_id != null && (
										<>
											{' · '}
											<Link to={reportsHref(base, { report_id: b.report_id, status: 'all' })} onClick={onClose} className="text-[var(--wc-saffron)] hover:underline">
												{t('admin.users.fromReport', { id: b.report_id })}
											</Link>
										</>
									)}
								</dd>
							</dl>
							{b.description && (
								<p className="mt-2 whitespace-pre-line break-words text-xs text-[var(--wc-text)]">
									<span className="text-[var(--wc-text-muted)]">{t('moderation.userMessage')}: </span>
									{b.description}
								</p>
							)}
							{b.internal_notes && (
								<p className="mt-2 whitespace-pre-line break-words rounded-lg border-l-4 border-[var(--wc-saffron)] bg-[var(--wc-bg)] px-3 py-2 text-xs text-[var(--wc-text)]">
									<span className="block font-semibold text-[var(--wc-saffron)]">{t('moderation.internalNotes')}</span>
									{b.internal_notes}
								</p>
							)}
							{b.unban_reason && (
								<p className="mt-1 whitespace-pre-line break-words text-xs text-[var(--wc-text-muted)]">
									{t('admin.users.unbanReason')}: {b.unban_reason}
								</p>
							)}
						</li>
					))}
				</ol>

				{data && (
					<Pagination
						className="mt-4"
						page={page}
						totalPages={data.total_pages}
						hasPrev={data.has_prev_page}
						hasNext={data.has_next_page}
						onChange={setPage}
					/>
				)}
			</div>
		</div>
	)
}

export default BanHistoryDrawer
