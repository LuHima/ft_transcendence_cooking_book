import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, getErrorMessage } from '../api/client'
import type { Friendship } from '../types/models'

interface FriendButtonProps {
	userId: number
	username: string
	friendship?: Friendship
	// nuovo stato dopo l'azione, per aggiornare la pagina che contiene il pulsante
	onChange: (next: Friendship) => void
}

const BASE = 'rounded-full px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60'
const PRIMARY = `${BASE} bg-[var(--wc-basil)] text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]`
const OUTLINE = `${BASE} border border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-paprika)] hover:text-[var(--wc-paprika)]`

// pulsante amicizia in stile Facebook:
//   nessuna relazione → "Aggiungi" → (richiesta inviata) → accettata = amici / rifiutata = non amici
//   richiesta ricevuta → "Accetta" / "Rifiuta"
function FriendButton({ userId, username, friendship, onChange }: FriendButtonProps) {
	const { t } = useTranslation()
	const { user } = useAuth()
	const toast = useToast()
	const navigate = useNavigate()
	const [busy, setBusy] = useState(false)

	async function run(action: () => Promise<Friendship>, successKey?: string) {
		setBusy(true)
		try {
			onChange(await action())
			if (successKey) toast.success(t(successKey, { name: username }))
		} catch (err) {
			toast.error(getErrorMessage(err, t('friends.actionError')))
		} finally {
			setBusy(false)
		}
	}

	const status = friendship?.status ?? 'none'
	const requestId = friendship?.request_id

	if (!user) {
		return (
			<button className={PRIMARY} onClick={() => navigate('/login')}>
				{t('friends.add')}
			</button>
		)
	}

	if (status === 'accepted') {
		return (
			<div className="flex items-center gap-2">
				<span className="rounded-full bg-[var(--wc-basil)] px-3 py-1 text-xs font-medium text-[var(--wc-bg)]">
					✓ {t('friends.friends')}
				</span>
				<button
					disabled={busy}
					className={OUTLINE}
					onClick={() => {
						if (!confirm(t('friends.confirmRemove', { name: username }))) return
						void run(async () => {
							await api.delete(`/friends/${userId}`)
							return { status: 'none' }
						}, 'friends.removed')
					}}
				>
					{t('friends.remove')}
				</button>
			</div>
		)
	}

	if (status === 'pending' && friendship?.direction === 'received' && requestId != null) {
		return (
			<div className="flex items-center gap-2">
				<button
					disabled={busy}
					className={PRIMARY}
					onClick={() =>
						void run(async () => {
							await api.post(`/friends/requests/${requestId}/accept`)
							return { status: 'accepted' }
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
							await api.post(`/friends/requests/${requestId}/reject`)
							return { status: 'none' }
						})
					}
				>
					{t('friends.reject')}
				</button>
			</div>
		)
	}

	if (status === 'pending') {
		return (
			<div className="flex items-center gap-2">
				<span className="rounded-full border border-[var(--wc-border)] px-3 py-1 text-xs text-[var(--wc-text-muted)]">
					{t('friends.requestSent')}
				</span>
				{requestId != null && (
					<button
						disabled={busy}
						className={OUTLINE}
						onClick={() =>
							void run(async () => {
								await api.delete(`/friends/requests/${requestId}`)
								return { status: 'none' }
							})
						}
					>
						{t('friends.cancelRequest')}
					</button>
				)}
			</div>
		)
	}

	// none o rejected: si può (ri)mandare la richiesta
	return (
		<button
			disabled={busy}
			className={PRIMARY}
			onClick={() =>
				void run(async () => {
					const res = await api.post<{ status?: 'pending' | 'accepted' }>(
						`/friends/requests/${userId}`,
					)
					return res.status === 'accepted'
						? { status: 'accepted' }
						: { status: 'pending', direction: 'sent', request_id: userId }
				}, 'friends.requestSentToast')
			}
		>
			{t('friends.add')}
		</button>
	)
}

export default FriendButton
