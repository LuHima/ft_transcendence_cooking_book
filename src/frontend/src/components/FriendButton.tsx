import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, getErrorMessage, toPage } from '../api/client'
import type { FriendRequest, Friendship } from '../types/models'

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
		// stesso stile di "Rimuovi dagli amici": bianco, rosso al passaggio del mouse
		return (
			<button
				disabled={busy}
				className={OUTLINE}
				onClick={() =>
					void run(async () => {
						let id = requestId
						if (id == null) {
							// il backend non ha restituito l'id: lo si cerca tra le richieste inviate
							const d = await api.get<unknown>('/friends/requests?type=outgoing')
							id = toPage<FriendRequest>(d).items.find((r) => r.username === username)?.id
						}
						if (id == null) throw new Error('request not found')
						await api.delete(`/friends/requests/${id}`)
						return { status: 'none' }
					})
				}
			>
				{t('friends.cancelRequest')}
			</button>
		)
	}

	// none o rejected: si può (ri)mandare la richiesta
	return (
		<button
			disabled={busy}
			className={PRIMARY}
			onClick={() =>
				void run(async () => {
					const res = await api.post<{ status?: 'pending' | 'accepted'; id?: number; request_id?: number }>(
						`/friends/requests/${userId}`,
					)
					if (res?.status === 'accepted') return { status: 'accepted' }
					// id reale della richiesta (serve per annullarla); se il backend non lo manda, "Annulla" non viene mostrato
					return { status: 'pending', direction: 'sent', request_id: res?.request_id ?? res?.id }
				}, 'friends.requestSentToast')
			}
		>
			{t('friends.add')}
		</button>
	)
}

export default FriendButton
