import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { AppNotification } from '../types/models'

const POLL_INTERVAL_MS = 60_000

const rtf = new Intl.RelativeTimeFormat('it', { numeric: 'auto' })

function timeAgo(iso: string) {
	const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
	if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
	const hours = Math.round(minutes / 60)
	if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
	return rtf.format(Math.round(hours / 24), 'day')
}

function NotificationBell() {
	const [items, setItems] = useState<AppNotification[]>([])
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// NB: endpoint da esporre lato backend: GET /notifications e PATCH /notifications/read
	const load = useCallback(() => {
		api
			.get<AppNotification[]>('/notifications')
			.then(setItems)
			.catch(() => {
				// le notifiche sono un extra: se falliscono non si mostra nessun errore
			})
	}, [])

	// primo caricamento + aggiornamento periodico (solo con la scheda visibile)
	useEffect(() => {
		load()
		const timer = setInterval(() => {
			if (!document.hidden) load()
		}, POLL_INTERVAL_MS)
		return () => clearInterval(timer)
	}, [load])

	const unreadCount = items.filter((n) => !n.is_read).length

	const close = useCallback(() => {
		setOpen(false)
		// alla chiusura le notifiche visualizzate vengono segnate come lette
		if (items.some((n) => !n.is_read)) {
			setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
			api.patch('/notifications/read').catch(() => {})
		}
	}, [items])

	useEffect(() => {
		if (!open) return
		function handleClickOutside(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) close()
		}
		function handleEscape(e: KeyboardEvent) {
			if (e.key === 'Escape') close()
		}
		document.addEventListener('mousedown', handleClickOutside)
		document.addEventListener('keydown', handleEscape)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
			document.removeEventListener('keydown', handleEscape)
		}
	}, [open, close])

	function toggle() {
		if (open) {
			close()
		} else {
			load()
			setOpen(true)
		}
	}

	// con il menu aperto il badge sparisce: le notifiche si stanno guardando
	const badge = open ? 0 : unreadCount

	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				onClick={toggle}
				aria-label={badge > 0 ? `Notifiche (${badge} non lette)` : 'Notifiche'}
				aria-haspopup="true"
				aria-expanded={open}
				className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-basil)]"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="h-5 w-5"
					aria-hidden="true"
				>
					<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
					<path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
				</svg>
				{badge > 0 && (
					<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--wc-paprika)] px-1 text-[10px] font-semibold leading-none text-[var(--wc-text)]">
						{badge > 9 ? '9+' : badge}
					</span>
				)}
			</button>

			{open && (
				<div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg">
					<div className="border-b border-[var(--wc-border)] px-4 py-2 text-sm font-semibold text-[var(--wc-text)]">
						Notifiche
					</div>
					{items.length === 0 ? (
						<p className="px-4 py-6 text-center text-sm text-[var(--wc-text-muted)]">Nessuna notifica per ora.</p>
					) : (
						<ul className="max-h-96 overflow-y-auto">
							{items.map((n) => (
								<li key={n.id}>
									<Link
										to={`/recipes/${n.recipe.id}`}
										onClick={close}
										className={`block px-4 py-3 text-sm text-[var(--wc-text)] hover:bg-[var(--wc-surface-raised)] ${
											n.is_read ? '' : 'bg-[var(--wc-surface-raised)]/60'
										}`}
									>
										<span className="font-semibold">{n.actor.username}</span>{' '}
										{n.type === 'like' ? 'ha messo like alla tua ricetta' : 'ha commentato la tua ricetta'}{' '}
										<span className="text-[var(--wc-saffron)]">{n.recipe.title}</span>
										<span className="mt-0.5 block text-xs text-[var(--wc-text-muted)]">{timeAgo(n.created_at)}</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	)
}

export default NotificationBell
