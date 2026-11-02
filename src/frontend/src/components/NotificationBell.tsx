import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useLang } from '../lib/useLang'
import { io } from 'socket.io-client'
import type { AppNotification } from '../types/models'

const POLL_INTERVAL_MS = 60_000

// testo e destinazione di una notifica in base a subject + action (modello Notification del backend)
function describe(n: AppNotification): { textKey: string; to: string } {
	const recipeTarget = n.recipe_id ?? (n.subject === 'recipe' ? n.target_id : null)
	const recipePath = recipeTarget != null ? `/recipes/${recipeTarget}` : '/'
	switch (n.action) {
		case 'friend_request':
			return { textKey: 'notifications.friend_request', to: '/friends' }
		case 'friend_accept':
			return { textKey: 'notifications.friend_accept', to: n.actor ? `/users/${n.actor.id}` : '/friends' }
		case 'like':
			return { textKey: 'notifications.like', to: recipePath }
		case 'comment':
			return { textKey: 'notifications.comment', to: recipePath }
		case 'post':
			return { textKey: 'notifications.post', to: recipePath }
	}
}

function timeAgo(iso: string, lang: string) {
	const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
	const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
	if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute')
	const hours = Math.round(minutes / 60)
	if (Math.abs(hours) < 24) return rtf.format(hours, 'hour')
	return rtf.format(Math.round(hours / 24), 'day')
}

function NotificationBell() {
	const { t } = useTranslation()
	const lang = useLang()
	const [items, setItems] = useState<AppNotification[]>([])
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// GET /api/notifications
	const load = useCallback(() => {
		api
			.get<{ notification: AppNotification[] }>('/notifications')
			.then((data) => setItems(data.notification))
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

	useEffect(() => {
		const socket = io(window.location.origin, { withCredentials: true })
		const onNewNotification = () => load()
		const onConnectError = (error: Error) => {
			console.error('Connection Socket.IO failed:', error)
		}

		socket.on('newNotification', onNewNotification)
		socket.on('connect_error', onConnectError)

		return () => {
			socket.off('newNotification', onNewNotification)
			socket.off('connect_error', onConnectError)
			socket.disconnect()
		}
	}, [load])

	const unreadCount = items.filter((n) => !n.is_read).length

	// PATCH /api/notifications/read/:id (una chiamata per notifica non letta)
	const markRead = useCallback((ids: number[]) => {
		if (ids.length === 0) return
		setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, is_read: true } : n)))
		ids.forEach((id) => api.patch(`/notifications/read/${id}`).catch(() => {}))
	}, [])

	const close = useCallback(() => {
		setOpen(false)
		// alla chiusura le notifiche visualizzate vengono segnate come lette
		markRead(items.filter((n) => !n.is_read).map((n) => n.id))
	}, [items, markRead])

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

	async function remove(id: number) {
		setItems((prev) => prev.filter((n) => n.id !== id))
		api.delete(`/notifications/delete/${id}`).catch(() => load())
	}

	// con il menu aperto il badge sparisce: le notifiche si stanno guardando
	const badge = open ? 0 : unreadCount

	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				onClick={toggle}
				aria-label={badge > 0 ? t('notifications.unread', { count: badge }) : t('notifications.title')}
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
						{t('notifications.title')}
					</div>
					{items.length === 0 ? (
						<p className="px-4 py-6 text-center text-sm text-[var(--wc-text-muted)]">{t('notifications.empty')}</p>
					) : (
						<ul className="max-h-96 overflow-y-auto">
							{items.map((n) => {
								const { textKey, to } = describe(n)
								return (
									<li
										key={n.id}
										className={`flex items-start gap-2 hover:bg-[var(--wc-surface-raised)] ${n.is_read ? '' : 'bg-[var(--wc-surface-raised)]/60'}`}
									>
										<Link to={to} onClick={close} className="block min-w-0 flex-1 px-4 py-3 text-sm text-[var(--wc-text)]">
											<span className="font-semibold">{n.actor?.username ?? t('notifications.someone')}</span>{' '}
											{t(textKey)}
											{n.recipe_title && <span className="text-[var(--wc-saffron)]"> {n.recipe_title}</span>}
											<span className="mt-0.5 block text-xs text-[var(--wc-text-muted)]">{timeAgo(n.created_at, lang)}</span>
										</Link>
										<button
											type="button"
											onClick={() => remove(n.id)}
											aria-label={t('common.delete')}
											className="px-3 py-3 text-[var(--wc-text-muted)] hover:text-[var(--wc-paprika)]"
										>
											×
										</button>
									</li>
								)
							})}
						</ul>
					)}
				</div>
			)}
		</div>
	)
}

export default NotificationBell