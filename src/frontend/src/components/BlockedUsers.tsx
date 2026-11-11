import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api, getErrorMessage, qs, toPage } from '../api/client'
import { useToast } from '../context/ToastContext'
import { useLang } from '../lib/useLang'
import Avatar from './Avatar'
import ConfirmDialog from './ConfirmDialog'
import Pagination from './Pagination'
import { ListSkeleton } from './Skeleton'
import type { BlockedUser, Paginated } from '../types/models'

const PAGE_SIZE = 20

// sezione "Utenti bloccati" nelle impostazioni del profilo:
//   GET    /users/me/blocks?page=&limit=   -> PaginatedBlockedUsersResponseDto
//   DELETE /users/:id/block                 sblocca
function BlockedUsers() {
	const { t } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const [page, setPage] = useState(1)
	const [data, setData] = useState<Paginated<BlockedUser> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [unblocking, setUnblocking] = useState<BlockedUser | null>(null)

	useEffect(() => {
		let cancelled = false
		api
			.get<unknown>(`/users/me/blocks${qs({ page, limit: PAGE_SIZE })}`)
			.then((res) => {
				if (cancelled) return
				setData(toPage<BlockedUser>(res, PAGE_SIZE))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setData(toPage<BlockedUser>([], PAGE_SIZE))
				setError(getErrorMessage(err, t('block.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [page, t])

	async function unblock(u: BlockedUser) {
		try {
			await api.delete(`/users/${u.id}/block`)
			setData((prev) => (prev ? { ...prev, items: prev.items.filter((x) => x.id !== u.id), total: Math.max(0, prev.total - 1) } : prev))
			toast.success(t('block.unblocked', { name: u.username }))
			setUnblocking(null)
		} catch (err) {
			toast.error(getErrorMessage(err, t('block.error')))
			setUnblocking(null)
		}
	}

	return (
		<section className="mt-10 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-5" aria-labelledby="blocked-title">
			<h2 id="blocked-title" className="font-display text-xl text-[var(--wc-saffron)]">
				{t('block.title')}
			</h2>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('block.intro')}</p>

			{error && <p className="mt-3 text-sm text-[var(--wc-paprika)]">{error}</p>}
			{!data && (
				<div className="mt-4">
					<ListSkeleton rows={2} />
				</div>
			)}
			{data && data.items.length === 0 && !error && <p className="mt-4 text-sm text-[var(--wc-text-muted)]">{t('block.empty')}</p>}

			{data && data.items.length > 0 && (
				<ul className="mt-4 divide-y divide-[var(--wc-border)]">
					{data.items.map((u) => (
						<li key={u.id} className="flex items-center justify-between gap-3 py-3">
							<div className="flex min-w-0 items-center gap-3">
								<Avatar username={u.username} url={u.avatar_url} className="h-9 w-9 text-sm" />
								<div className="min-w-0">
									<span className="block truncate font-medium text-[var(--wc-text)]">{u.username}</span>
									<span className="block text-xs text-[var(--wc-text-muted)]">
										{t('block.blockedOn', {
											date: new Date(u.blocked_at).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' }),
										})}
									</span>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setUnblocking(u)}
								className="shrink-0 rounded-full border border-[var(--wc-border)] px-3 py-1 text-sm hover:border-[var(--wc-basil)]"
							>
								{t('block.unblock')}
							</button>
						</li>
					))}
				</ul>
			)}

			{data && <Pagination page={data.page} totalPages={data.total_pages} onChange={setPage} />}

			{unblocking && (
				<ConfirmDialog
					title={t('block.confirmUnblock', { name: unblocking.username })}
					confirmLabel={t('block.unblock')}
					onConfirm={() => unblock(unblocking)}
					onClose={() => setUnblocking(null)}
				>
					<p>{t('block.unblockHelp')}</p>
				</ConfirmDialog>
			)}
		</section>
	)
}

export default BlockedUsers
