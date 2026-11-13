import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, getErrorMessage } from '../api/client'
import type { FriendshipStatus } from '../types/models'

interface FriendButtonProps {
	userId: number
	username: string
	// friendship_status from GET /users/:id or GET /users (null/undefined = unknown or signed out)
	status?: FriendshipStatus | null
	onChange: (next: FriendshipStatus) => void
}

const BASE = 'rounded-full px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60'
const PRIMARY = `${BASE} bg-[var(--wc-basil)] text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]`
const OUTLINE = `${BASE} border border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-paprika)] hover:text-[var(--wc-paprika)]`

// Every route takes the other user's ID:
//   POST   /friends/requests/:addresseeId          send (instant friendship if they already asked)
//   DELETE /friends/requests/:addresseeId          cancel the sent request
//   POST   /friends/requests/:requesterId/accept   accept
//   POST   /friends/requests/:requesterId/reject   reject (starts a 30-day cooldown for the sender)
//   DELETE /friends/:friendId                      remove the friendship
function FriendButton({ userId, username, status, onChange }: FriendButtonProps) {
	const { t } = useTranslation()
	const { user } = useAuth()
	const toast = useToast()
	const navigate = useNavigate()
	const [busy, setBusy] = useState(false)
	// Inline notice for 409 (request already exists or cooldown active)
	const [notice, setNotice] = useState<string | null>(null)

	async function run(action: () => Promise<FriendshipStatus>, successKey?: string) {
		setBusy(true)
		setNotice(null)
		try {
			onChange(await action())
			if (successKey) toast.success(t(successKey, { name: username }))
		} catch (err) {
			toast.error(getErrorMessage(err, t('friends.actionError')))
		} finally {
			setBusy(false)
		}
	}

	if (!user) {
		return (
			<button className={PRIMARY} onClick={() => navigate('/login')}>
				{t('friends.add')}
			</button>
		)
	}

	const current: FriendshipStatus = status ?? 'none'

	if (current === 'friends') {
		return (
			<button
				disabled={busy}
				className={OUTLINE}
				onClick={() => {
					if (!confirm(t('friends.confirmRemove', { name: username }))) return
					void run(async () => {
						await api.delete(`/friends/${userId}`)
						return 'none'
					}, 'friends.removed')
				}}
			>
				{t('friends.remove')}
			</button>
		)
	}

	if (current === 'pending_received') {
		return (
			<div className="flex items-center gap-2">
				<button
					disabled={busy}
					className={PRIMARY}
					onClick={() =>
						void run(async () => {
							await api.post(`/friends/requests/${userId}/accept`)
							return 'friends'
						}, 'friends.nowFriends')
					}
				>
					{t('friends.accept')}
				</button>
				<button
					disabled={busy}
					className={OUTLINE}
					onClick={() =>
						void run(async () => {
							await api.post(`/friends/requests/${userId}/reject`)
							return 'none'
						})
					}
				>
					{t('friends.reject')}
				</button>
			</div>
		)
	}

	if (current === 'pending_sent') {
		return (
			<button
				disabled={busy}
				className={OUTLINE}
				onClick={() =>
					void run(async () => {
						await api.delete(`/friends/requests/${userId}`)
						return 'none'
					})
				}
			>
				{t('friends.cancelRequest')}
			</button>
		)
	}

	async function sendRequest() {
		setBusy(true)
		setNotice(null)
		try {
			const res = await api.post<{ status?: 'pending' | 'accepted' }>(`/friends/requests/${userId}`)
			// If the other user had already sent a request, the backend creates the friendship immediately
			if (res?.status === 'accepted') {
				onChange('friends')
				toast.success(t('friends.nowFriends', { name: username }))
			} else {
				onChange('pending_sent')
				toast.success(t('friends.requestSentToast', { name: username }))
			}
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				// Existing request or 30-day anti-harassment cooldown after a rejection
				const msg = t('friends.cooldown')
				setNotice(msg)
				toast.info(msg)
			} else {
				toast.error(getErrorMessage(err, t('friends.actionError')))
			}
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<button disabled={busy} className={PRIMARY} onClick={() => void sendRequest()}>
				{t('friends.add')}
			</button>
			{notice && (
				<p role="status" className="max-w-xs text-right text-xs text-[var(--wc-saffron)]">
					{notice}
				</p>
			)}
		</div>
	)
}

export default FriendButton
