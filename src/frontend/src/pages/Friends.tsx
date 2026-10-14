import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError, asArray } from '../api/client'
import Avatar from '../components/Avatar'
import type { PublicUser } from '../types/models'

// NB: endpoint da esporre lato backend: GET /users/me/following e GET /users/me/followers
type Tab = 'following' | 'followers'

function Friends() {
	const [tab, setTab] = useState<Tab>('following')
	const [users, setUsers] = useState<PublicUser[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		api
			.get<PublicUser[]>(`/users/me/${tab}`)
			.then((data) => {
				if (cancelled) return
				setUsers(asArray<PublicUser>(data))
				setError(null)
			})
			.catch((err) => {
				if (cancelled) return
				setUsers([])
				setError(err instanceof ApiError ? err.message : 'Impossibile caricare l\'elenco.')
			})
		return () => {
			cancelled = true
			setUsers(null)
		}
	}, [tab])

	const tabClass = (t: Tab) =>
		`rounded-full px-4 py-1.5 text-sm transition-colors ${
			tab === t
				? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]'
				: 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'
		}`

	return (
		<div className="mx-auto max-w-2xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">Amici</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">
				Cerca un utente dalla barra di ricerca e premi «Segui» sul suo profilo. Se vi seguite a vicenda siete amici.
			</p>

			<div className="mt-6 flex gap-2">
				<button className={tabClass('following')} onClick={() => setTab('following')}>
					Seguiti
				</button>
				<button className={tabClass('followers')} onClick={() => setTab('followers')}>
					Follower
				</button>
			</div>

			{error && <p className="mt-4 text-[var(--wc-paprika)]">{error}</p>}
			{users === null && <p className="mt-6 text-[var(--wc-text-muted)]">Caricamento…</p>}
			{users && users.length === 0 && !error && (
				<p className="mt-6 text-[var(--wc-text-muted)]">
					{tab === 'following' ? 'Non segui ancora nessuno.' : 'Nessuno ti segue ancora.'}
				</p>
			)}

			<ul className="mt-6 divide-y divide-[var(--wc-border)] rounded-2xl border border-[var(--wc-border)]">
				{users?.map((u) => (
					<li key={u.id}>
						<Link to={`/users/${u.id}`} className="flex items-center gap-3 p-4 hover:bg-[var(--wc-surface)]">
							<Avatar username={u.username} url={u.avatar_url} className="h-10 w-10 text-base" />
							<span className="font-medium text-[var(--wc-text)]">{u.username}</span>
							{u.is_following && u.follows_me && (
								<span className="ml-auto rounded-full bg-[var(--wc-basil)] px-2 py-0.5 text-xs text-[var(--wc-bg)]">
									Amici
								</span>
							)}
						</Link>
					</li>
				))}
			</ul>
		</div>
	)
}

export default Friends
