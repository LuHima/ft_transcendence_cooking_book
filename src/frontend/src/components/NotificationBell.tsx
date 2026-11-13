import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api, qs } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../lib/useLang'
import Avatar from './Avatar'
import { acquireSocket, releaseSocket } from '../lib/socket'
import type { AppNotification, PaginatedNotifications } from '../types/models'

const POLL_INTERVAL_MS = 60_000
const PAGE_SIZE = 20

// Notification text and link from subject + action.
// target.id is the recipe for 'recipe' and the comment for 'comment'; comments carry their recipe in target.recipe_id.
function describe(n: AppNotification, currentUserId?: number): { textKey: string; to: string } {
	const recipeId = n.target?.recipe_id ?? (n.subject === 'recipe' ? (n.target?.id ?? null) : null)
	const actorPath = n.actor ? `/users/${n.actor.id}` : '/'
	const recipePath = recipeId != null ? `/recipes/${recipeId}` : actorPath
	switch (n.action) {
		case 'friend_request':
			return { textKey: 'notifications.friend_request', to: '/friends' }
		case 'friend_accept':
			return { textKey: 'notifications.friend_accept', to: n.actor ? `/users/${n.actor.id}` : '/friends' }
		case 'like':
			return { textKey: 'notifications.like', to: recipePath }
		case 'comment':
			return n.subject === 'comment'
				? { textKey: 'notifications.reply', to: recipePath }
				: { textKey: 'notifications.comment', to: recipePath }
		case 'post':
			return { textKey: 'notifications.post', to: recipePath }
		case 'update':
			return { textKey: 'notifications.update', to: recipePath }
		case 'warn':
			// Moderation warning: never link to the moderator (staff identity is hidden).
			// Recipe or comment → that recipe; profile → the user's own profile.
			if (n.subject === 'user') return { textKey: 'notifications.warn', to: currentUserId != null ? `/users/${currentUserId}` : '/' }
			return { textKey: 'notifications.warn', to: recipeId != null ? `/recipes/${recipeId}` : '/' }
		case 'delete':
			// The recipe no longer exists: no link
			return { textKey: 'notifications.delete', to: '/' }
		default:
			// Actions added later by the backend must not break the menu
			return { textKey: 'notifications.generic', to: n.subject === 'user' ? actorPath : recipePath }
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

// Moderation-team shield, shown instead of an avatar on warnings
function ModerationBadge() {
	return (
		<span
			aria-hidden="true"
			className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wc-paprika)] text-[var(--wc-bg)]"
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
				<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
				<path d="M12 8v4" />
				<path d="M12 16h.01" />
			</svg>
		</span>
	)
}

function NotificationBell() {
	const { t } = useTranslation()
	const { user } = useAuth()
	const lang = useLang()
	const [items, setItems] = useState<AppNotification[]>([])
	// Server-side counter (includes unread notifications beyond the first page)
	const [unreadCount, setUnreadCount] = useState(0)
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	const load = useCallback(() => {
		api
			.get<PaginatedNotifications>(`/notifications${qs({ page: 1, limit: PAGE_SIZE, lang })}`)
			.then((data) => {
				const list = Array.isArray(data?.items) ? data.items : []
				setItems(list)
				setUnreadCount(typeof data?.unread_count === 'number' ? data.unread_count : list.filter((n) => !n.is_read).length)
			})
			.catch(() => {
				// Notifications are non-essential: fail silently
			})
	}, [lang])

	// Initial load + periodic polling (only while the tab is visible)
	useEffect(() => {
		load()
		const timer = setInterval(() => {
			if (!document.hidden) load()
		}, POLL_INTERVAL_MS)
		return () => clearInterval(timer)
	}, [load])

	useEffect(() => {
		const socket = acquireSocket()
		const onNewNotification = () => load()
		const onConnectError = (error: Error) => {
			console.error('Connection Socket.IO failed:', error)
		}

		socket.on('newNotification', onNewNotification)
		socket.on('connect_error', onConnectError)

		return () => {
			socket.off('newNotification', onNewNotification)
			socket.off('connect_error', onConnectError)
			releaseSocket()
		}
	}, [load])

	// A single request marks every unread notification as read
	const markAllRead = useCallback(
		(hasUnread: boolean) => {
			if (!hasUnread) return
			setItems((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true })))
			setUnreadCount(0)
			api.patch('/notifications/read-all').catch(() => load())
		},
		[load],
	)

	const markRead = useCallback(
		(n: AppNotification) => {
			if (n.is_read) return
			setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
			setUnreadCount((c) => Math.max(0, c - 1))
			api.patch(`/notifications/${n.id}/read`).catch(() => load())
		},
		[load],
	)

	const close = useCallback(() => {
		setOpen(false)
		// Notifications seen while the menu was open are marked as read on close
		markAllRead(unreadCount > 0 || items.some((n) => !n.is_read))
	}, [items, unreadCount, markAllRead])

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

	function remove(n: AppNotification) {
		setItems((prev) => prev.filter((x) => x.id !== n.id))
		if (!n.is_read) setUnreadCount((c) => Math.max(0, c - 1))
		api.delete(`/notifications/${n.id}`).catch(() => load())
	}

	// Hide the badge while the menu is open
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
								const { textKey, to } = describe(n, user?.id)
								const isWarn = n.action === 'warn'
								return (
									<li
										key={n.id}
										className={`flex items-start gap-2 hover:bg-[var(--wc-surface-raised)] ${n.is_read ? '' : 'bg-[var(--wc-surface-raised)]/60'}`}
									>
										<Link
											to={to}
											onClick={() => {
												markRead(n)
												close()
											}}
											className="flex min-w-0 flex-1 items-start gap-3 px-4 py-3 text-sm text-[var(--wc-text)]"
										>
											{isWarn ? (
												<ModerationBadge />
											) : (
												/* actor idratato dal backend (id, username, avatar_url); null = sistema / utente eliminato */
												<Avatar
													username={n.actor?.username ?? '?'}
													url={n.actor?.avatar_url}
													className="mt-0.5 h-8 w-8 text-xs"
												/>
											)}
											<span className="min-w-0 flex-1">
												{isWarn ? (
													<>
														{/* Staff identity is hidden: no moderator name */}
														<span className="font-semibold text-[var(--wc-paprika)]">{t('notifications.moderationTeam')}</span>
														{/* Already localized by the backend (?lang=) */}
														<span className="block">{n.message || t('notifications.warnFallback')}</span>
														{n.details && (
															<span
																role="note"
																className="mt-1.5 block whitespace-pre-line break-words rounded-lg border-l-4 border-[var(--wc-paprika)] bg-[var(--wc-bg)] px-3 py-2 text-xs text-[var(--wc-text)]"
															>
																<span className="mb-0.5 block font-semibold text-[var(--wc-paprika)]">{t('notifications.moderatorNote')}</span>
																{n.details}
															</span>
														)}
													</>
												) : (
													<>
														<span className="font-semibold">{n.actor?.username ?? t('notifications.someone')}</span>{' '}
														{t(textKey)}
														{n.subject === 'recipe' && n.action !== 'delete' && n.target?.title_or_snippet && (
															<span className="text-[var(--wc-saffron)]"> {n.target.title_or_snippet}</span>
														)}
													</>
												)}
												{n.subject === 'comment' && n.target?.title_or_snippet && (
													<span className="block truncate italic text-[var(--wc-text-muted)]">“{n.target.title_or_snippet}”</span>
												)}
												<span className="mt-0.5 block text-xs text-[var(--wc-text-muted)]">{timeAgo(n.created_at, lang)}</span>
											</span>
										</Link>
										<button
											type="button"
											onClick={() => remove(n)}
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