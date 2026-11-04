import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { GOOGLE_CLIENT_ID } from '../config'

// Google Identity Services: lo script di Google mostra il pulsante e, dopo il consenso,
// restituisce un ID token (JWT firmato da Google) che passiamo al backend /auth/signin/google.
interface GoogleIdApi {
	initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void
	renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void
}

declare global {
	interface Window {
		google?: { accounts: { id: GoogleIdApi } }
	}
}

let scriptPromise: Promise<void> | null = null

function loadGoogleScript(): Promise<void> {
	if (window.google?.accounts?.id) return Promise.resolve()
	if (!scriptPromise) {
		scriptPromise = new Promise<void>((resolve, reject) => {
			const script = document.createElement('script')
			script.src = 'https://accounts.google.com/gsi/client'
			script.async = true
			script.defer = true
			script.onload = () => resolve()
			script.onerror = () => {
				scriptPromise = null
				reject(new Error('Impossibile caricare lo script di Google'))
			}
			document.head.appendChild(script)
		})
	}
	return scriptPromise
}

interface Props {
	// riceve l'ID token di Google da inviare al backend
	onCredential: (idToken: string) => void
}

// senza VITE_GOOGLE_CLIENT_ID il pulsante non viene mostrato
function GoogleSignInButton({ onCredential }: Props) {
	const { i18n } = useTranslation()
	const containerRef = useRef<HTMLDivElement>(null)
	const onCredentialRef = useRef(onCredential)

	useEffect(() => {
		onCredentialRef.current = onCredential
	})

	useEffect(() => {
		const clientId = GOOGLE_CLIENT_ID
		if (!clientId) return
		let cancelled = false
		loadGoogleScript()
			.then(() => {
				const gid = window.google?.accounts.id
				const container = containerRef.current
				if (cancelled || !gid || !container) return
				gid.initialize({
					client_id: clientId,
					callback: (response) => {
						if (response.credential) onCredentialRef.current(response.credential)
					},
				})
				container.replaceChildren()
				gid.renderButton(container, {
					type: 'standard',
					theme: 'filled_black',
					size: 'large',
					shape: 'pill',
					text: 'continue_with',
					width: 320,
					locale: i18n.language,
				})
			})
			.catch(() => {
				// script bloccato (offline, adblock…): resta il login con email e password
			})
		return () => {
			cancelled = true
		}
	}, [i18n.language])

	if (!GOOGLE_CLIENT_ID) return null
	return <div ref={containerRef} className="flex min-h-[44px] justify-center" />
}

export default GoogleSignInButton
