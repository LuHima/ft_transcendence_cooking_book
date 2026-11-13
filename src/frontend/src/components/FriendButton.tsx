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
	// friendship_status restituito da GET /users/:id o GET /users (null/undefined = sconosciuto o non loggato)
	status?: FriendshipStatus | null
	// nuovo stato dopo l'azione, per aggiornare la pagina che contiene il pulsante
	onChange: (next: FriendshipStatus) => void
}

const BASE = 'rounded-full px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60'
const PRIMARY = `${BASE} bg-[var(--wc-basil)] text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]`
const OUTLINE = `${BASE} border border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-paprika)] hover:text-[var(--wc-paprika)]`

// pulsante amicizia. Tutte le rotte usano l'id dell'altro utente:
//   POST   /friends/requests/:addresseeId           invia (se l'altro aveva già chiesto → amici subito)
//   DELETE /friends/requests/:addresseeId           annulla la richiesta inviata
//   POST   /friends/requests/:requesterId/accept    accetta
//   POST   /friends/requests/:requesterId/reject    rifiuta (attiva il cooldown di 30 giorni per il mittente)
//   DELETE /friends/:friendId                       rimuove l'amicizia
function FriendButton({ userId, username, status, onChange }: FriendButtonProps) {
	const { t } = useTranslation()
	const { user } = useAuth()
	const toast = useToast()
	const navigate = useNavigate()
	const [busy, setBusy] = useState(false)
	// avviso inline per il 409 (richiesta già esistente o cooldown attivo)
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
		// stesso stile di "Rimuovi dagli amici": bianco, rosso al passaggio del mouse
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

	// none: si può mandare la richiesta
	async function sendRequest() {
		setBusy(true)
		setNotice(null)
		try {
			const res = await api.post<{ status?: 'pending' | 'accepted' }>(`/friends/requests/${userId}`)
			// se l'altro utente aveva già inviato una richiesta, il backend crea subito l'amicizia
			if (res?.status === 'accepted') {
				onChange('friends')
				toast.success(t('friends.nowFriends', { name: username }))
			} else {
				onChange('pending_sent')
				toast.success(t('friends.requestSentToast', { name: username }))
			}
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				// richiesta già esistente o cooldown anti-molestie di 30 giorni dopo un rifiuto
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
