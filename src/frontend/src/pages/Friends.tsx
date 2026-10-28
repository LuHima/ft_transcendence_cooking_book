import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, asArray, getErrorMessage, toPage } from '../api/client'
import { useToast } from '../context/ToastContext'
import Avatar from '../components/Avatar'
import { ListSkeleton } from '../components/Skeleton'
import type { FriendRequest, PublicUser } from '../types/models'

// NB: endpoint da esporre lato backend:
//   GET /friends                                 -> amici (array o Paginated<PublicUser>)
//   GET /friends/requests?direction=received|sent -> FriendRequest[]  { id, user, created_at }
//   POST /friends/requests/:id/accept | /reject, DELETE /friends/requests/:id (annulla), DELETE /friends/:userId
type Tab = 'friends' | 'received' | 'sent'
const TABS: Tab[] = ['friends', 'received', 'sent']

function Friends() {
	const { t } = useTranslation()
	const toast = useToast()
	const [tab, setTab] = useState<Tab>('friends')
	const [friends, setFriends] = useState<PublicUser[] | null>(null)
	const [requests, setRequests] = useState<FriendRequest[] | null>(null)
	const [receivedCount, setReceivedCount] = useState(0)
	const [error, setError] = useState<string | null>(null)
	const [busyId, setBusyId] = useState<number | null>(null)

	// le richieste ricevute si caricano subito per mostrare il numero sulla scheda
	useEffect(() => {
		api
			.get<unknown>('/friends/requests?direction=received')
			.then((d) => setReceivedCount(asArray<FriendRequest>(d).length))
			.catch(() => setReceivedCount(0))
	}, [])

	useEffect(() => {
		let cancelled = false
		const request =
			tab === 'friends'
				? api.get<unknown>('/friends').then((d) => {
						if (!cancelled) setFriends(toPage<PublicUser>(d).items)
					})
				: api.get<unknown>(`/friends/requests?direction=${tab}`).then((d) => {
						if (!cancelled) setRequests(asArray<FriendRequest>(d))
					})
		request
			.then(() => {
				if (!cancelled) setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				if (tab === 'friends') setFriends([])
				else setRequests([])
				setError(getErrorMessage(err, t('friends.loadError')))
			})
		return () => {
			cancelled = true
		}
	}, [tab, t])

	const answer = useCallback(
		async (req: FriendRequest, action: 'accept' | 'reject' | 'cancel') => {
			setBusyId(req.id)
			try {
				if (action === 'cancel') await api.delete(`/friends/requests/${req.id}`)
				else await api.post(`/friends/requests/${req.id}/${action}`)
				setRequests((prev) => prev?.filter((r) => r.id !== req.id) ?? null)
				if (action !== 'cancel') setReceivedCount((n) => Math.max(0, n - 1))
				if (action === 'accept') toast.success(t('friends.nowFriends', { name: req.user.username }))
			} catch (err) {
				toast.error(getErrorMessage(err, t('friends.actionError')))
			} finally {
				setBusyId(null)
			}
		},
		[t, toast],
	)

	async function removeFriend(u: PublicUser) {
		if (!confirm(t('friends.confirmRemove', { name: u.username }))) return
		setBusyId(u.id)
		try {
			await api.delete(`/friends/${u.id}`)
			setFriends((prev) => prev?.filter((x) => x.id !== u.id) ?? null)
			toast.success(t('friends.removed', { name: u.username }))
		} catch (err) {
			toast.error(getErrorMessage(err, t('friends.actionError')))
		} finally {
			setBusyId(null)
		}
	}

	const tabClass = (x: Tab) =>
		`rounded-full px-4 py-1.5 text-sm transition-colors ${
			tab === x ? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'
		}`
	const outlineBtn =
		'rounded-full border border-[var(--wc-border)] px-3 py-1 text-sm hover:border-[var(--wc-basil)] disabled:opacity-50'

	const list = tab === 'friends' ? friends : requests
	const loading = list === null && !error

	return (
		<div className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('nav.friends')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('friends.intro')}</p>

			<div className="mt-6 flex flex-wrap gap-2" role="tablist">
				{TABS.map((x) => (
					<button key={x} role="tab" aria-selected={tab === x} className={tabClass(x)} onClick={() => setTab(x)}>
						{t(`friends.tabs.${x}`)}
						{x === 'received' && receivedCount > 0 && (
							<span className="ml-2 rounded-full bg-[var(--wc-paprika)] px-1.5 text-[10px] font-semibold text-[var(--wc-text)]">
								{receivedCount}
							</span>
						)}
					</button>
				))}
			</div>

			{error && <p className="mt-4 text-[var(--wc-paprika)]">{error}</p>}
			{loading && <div className="mt-6"><ListSkeleton rows={3} /></div>}
			{list && list.length === 0 && !error && <p className="mt-6 text-[var(--wc-text-muted)]">{t(`friends.empty.${tab}`)}</p>}

			{tab === 'friends' && friends && friends.length > 0 && (
				<ul className="mt-6 divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
					{friends.map((u) => (
						<li key={u.id} className="flex items-center justify-between gap-3 p-4">
							<Link to={`/users/${u.id}`} className="flex min-w-0 items-center gap-3 hover:text-[var(--wc-saffron)]">
								<Avatar username={u.username} url={u.avatar_url} className="h-10 w-10 text-base" />
								<span className="truncate font-medium">{u.username}</span>
							</Link>
							<button className={`${outlineBtn} text-[var(--wc-paprika)]`} disabled={busyId === u.id} onClick={() => removeFriend(u)}>
								{t('friends.remove')}
							</button>
						</li>
					))}
				</ul>
			)}

			{tab !== 'friends' && requests && requests.length > 0 && (
				<ul className="mt-6 divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
					{requests.map((r) => (
						<li key={r.id} className="flex items-center justify-between gap-3 p-4">
							<Link to={`/users/${r.user.id}`} className="flex min-w-0 items-center gap-3 hover:text-[var(--wc-saffron)]">
								<Avatar username={r.user.username} url={r.user.avatar_url} className="h-10 w-10 text-base" />
								<span className="truncate font-medium">{r.user.username}</span>
							</Link>
							<div className="flex shrink-0 gap-2">
								{tab === 'received' ? (
									<>
										<button
											disabled={busyId === r.id}
											onClick={() => answer(r, 'accept')}
											className="rounded-full bg-[var(--wc-basil)] px-3 py-1 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-50"
										>
											{t('friends.accept')}
										</button>
										<button className={outlineBtn} disabled={busyId === r.id} onClick={() => answer(r, 'reject')}>
											{t('friends.reject')}
										</button>
									</>
								) : (
									<button className={outlineBtn} disabled={busyId === r.id} onClick={() => answer(r, 'cancel')}>
										{t('friends.cancelRequest')}
									</button>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

export default Friends