import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, getErrorMessage } from '../api/client'
import { INPUT_CLASS, LABEL_CLASS } from '../lib/ui'
import PasswordInput from './PasswordInput'
import ShowPasswordToggle from './ShowPasswordToggle'

type Step = 'idle' | 'password' | 'verify'

// attivazione / disattivazione dell'autenticazione a due fattori (TOTP):
//   POST /auth/twofactor/enable  { password }  -> { qrCode (data URI), key (base32) }
//   POST /auth/twofactor/verify  { code }      -> attiva la 2FA
//   POST /auth/twofactor/disable { password }
// NB: GET /users/me non restituisce ancora lo stato della 2FA (campo is_two_factor_enabled del modello User):
// finché manca, lo stato si ricava dalle risposte 409 ("già attiva" / "già disattivata").
function TwoFactorSettings() {
	const { t } = useTranslation()
	const toast = useToast()
	const { user, refreshUser } = useAuth()
	const [enabled, setEnabled] = useState(Boolean(user?.is_two_factor_enabled))
	const [step, setStep] = useState<Step>('idle')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [qrCode, setQrCode] = useState<string | null>(null)
	const [secret, setSecret] = useState<string | null>(null)
	const [code, setCode] = useState('')
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	function reset() {
		setStep('idle')
		setPassword('')
		setQrCode(null)
		setSecret(null)
		setCode('')
		setError(null)
	}

	async function submitPassword(e: FormEvent) {
		e.preventDefault()
		setBusy(true)
		setError(null)
		try {
			if (enabled) {
				await api.post('/auth/twofactor/disable', { password })
				setEnabled(false)
				toast.success(t('twofa.disabledToast'))
				reset()
				await refreshUser()
			} else {
				const res = await api.post<{ qrCode: string; key: string }>('/auth/twofactor/enable', { password })
				setQrCode(res.qrCode)
				setSecret(res.key)
				setStep('verify')
			}
		} catch (err) {
			if (err instanceof ApiError && err.status === 409) {
				// stato locale non allineato con il server
				setEnabled(!enabled)
				toast.info(enabled ? t('twofa.alreadyDisabled') : t('twofa.alreadyEnabled'))
				reset()
			} else {
				setError(getErrorMessage(err, t('twofa.passwordError')))
			}
		} finally {
			setBusy(false)
		}
	}

	async function submitCode(e: FormEvent) {
		e.preventDefault()
		setBusy(true)
		setError(null)
		try {
			await api.post('/auth/twofactor/verify', { code })
			setEnabled(true)
			toast.success(t('twofa.enabledToast'))
			reset()
			await refreshUser()
		} catch (err) {
			setError(getErrorMessage(err, t('twofa.codeError')))
			setCode('')
		} finally {
			setBusy(false)
		}
	}

	const btn = 'rounded-full border border-[var(--wc-border)] px-4 py-2 text-sm hover:border-[var(--wc-basil)]'

	return (
		<section className="mt-10 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-5">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('twofa.title')}</h2>
					<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('twofa.intro')}</p>
				</div>
				{step === 'idle' && (
					<button
						type="button"
						onClick={() => setStep('password')}
						className={enabled ? `${btn} text-[var(--wc-paprika)]` : 'rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]'}
					>
						{enabled ? t('twofa.disable') : t('twofa.enable')}
					</button>
				)}
			</div>

			{step === 'idle' && enabled && (
				<p className="mt-3 text-sm text-[var(--wc-basil)]">✓ {t('twofa.active')}</p>
			)}

			{step === 'password' && (
				<form onSubmit={submitPassword} className="mt-4 space-y-3">
					<PasswordInput
						id="twofa-password"
						label={t('twofa.confirmWithPassword')}
						autoComplete="current-password"
						minLength={9}
						value={password}
						onChange={setPassword}
						show={showPassword}
					/>
					<ShowPasswordToggle id="twofa-show" checked={showPassword} onChange={setShowPassword} />
					{error && <p role="alert" className="text-sm text-[var(--wc-paprika)]">{error}</p>}
					<div className="flex gap-2">
						<button type="submit" disabled={busy} className="rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] disabled:opacity-60">
							{busy ? t('common.sending') : t('twofa.continue')}
						</button>
						<button type="button" onClick={reset} className={btn}>
							{t('common.cancel')}
						</button>
					</div>
				</form>
			)}

			{step === 'verify' && (
				<form onSubmit={submitCode} className="mt-4 space-y-4">
					<p className="text-sm text-[var(--wc-text)]">{t('twofa.scan')}</p>
					{qrCode && <img src={qrCode} alt={t('twofa.qrAlt')} className="h-44 w-44 rounded-lg bg-white p-2" />}
					{secret && (
						<p className="text-xs text-[var(--wc-text-muted)]">
							{t('twofa.manualKey')} <code className="break-all rounded bg-[var(--wc-surface-raised)] px-1.5 py-0.5 text-[var(--wc-text)]">{secret}</code>
						</p>
					)}
					<div>
						<label htmlFor="twofa-code" className={LABEL_CLASS}>
							{t('twofa.enterCode')}
						</label>
						<input
							id="twofa-code"
							inputMode="numeric"
							autoComplete="one-time-code"
							pattern="[0-9]{6}"
							maxLength={6}
							required
							value={code}
							onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
							className={`${INPUT_CLASS} max-w-[12rem] text-center text-lg tracking-[0.4em]`}
						/>
					</div>
					{error && <p role="alert" className="text-sm text-[var(--wc-paprika)]">{error}</p>}
					<div className="flex gap-2">
						<button type="submit" disabled={busy || code.length !== 6} className="rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] disabled:opacity-60">
							{busy ? t('common.sending') : t('twofa.activate')}
						</button>
						<button type="button" onClick={reset} className={btn}>
							{t('common.cancel')}
						</button>
					</div>
				</form>
			)}
		</section>
	)
}

export default TwoFactorSettings
