import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../api/client'
import { INPUT_CLASS, LABEL_CLASS } from '../lib/ui'
import PasswordInput from '../components/PasswordInput'
import ShowPasswordToggle from '../components/ShowPasswordToggle'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { GOOGLE_CLIENT_ID } from '../config'

function Login() {
	const { t } = useTranslation()
	const { signIn, signInWithGoogle, completeTwoFactor } = useAuth()
	const navigate = useNavigate()
	const location = useLocation()
	const locationState = location.state as { from?: Location; tempToken?: string } | null
	const from = locationState?.from?.pathname ?? '/'

	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	// se la 2FA è attiva il backend restituisce un token temporaneo da completare con il codice a 6 cifre
	// (può arrivare già dalla pagina di registrazione, se l'accesso con Google richiede la 2FA)
	const [tempToken, setTempToken] = useState<string | null>(locationState?.tempToken ?? null)
	const [showPassword, setShowPassword] = useState(false)
	const [code, setCode] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)
	const passwordRef = useRef<HTMLInputElement>(null)

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		setSubmitting(true)
		try {
			if (tempToken) {
				await completeTwoFactor(tempToken, code)
				navigate(from, { replace: true })
				return
			}
			const result = await signIn(email, password)
			if (result.twoFactor) {
				setTempToken(result.tempToken)
				return
			}
			navigate(from, { replace: true })
		} catch (err) {
			setError(getErrorMessage(err, t('auth.loginError')))
			if (tempToken) {
				setCode('')
			} else {
				// accesso fallito: si svuota la password (l'email resta) e si rimette il cursore sul campo
				setPassword('')
				passwordRef.current?.focus()
			}
		} finally {
			setSubmitting(false)
		}
	}

	async function handleGoogle(idToken: string) {
		setError(null)
		try {
			const result = await signInWithGoogle(idToken)
			if (result.twoFactor) {
				setTempToken(result.tempToken)
				return
			}
			navigate(from, { replace: true })
		} catch (err) {
			setError(getErrorMessage(err, t('auth.googleError')))
		}
	}

	return (
		<div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('auth.welcomeBack')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{tempToken ? t('auth.twoFactorIntro') : t('auth.loginIntro')}</p>

			<form onSubmit={handleSubmit} className="mt-8 space-y-4">
				{tempToken ? (
					<div>
						<label htmlFor="code" className={LABEL_CLASS}>
							{t('auth.twoFactorCode')}
						</label>
						<input
							id="code"
							inputMode="numeric"
							autoComplete="one-time-code"
							pattern="[0-9]{6}"
							maxLength={6}
							required
							autoFocus
							value={code}
							onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
							className={`${INPUT_CLASS} text-center text-lg tracking-[0.4em]`}
						/>
					</div>
				) : (
					<>
						<div>
							<label htmlFor="email" className={LABEL_CLASS}>
								Email
							</label>
							<input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
						</div>
						<PasswordInput
							id="password"
							label="Password"
							inputRef={passwordRef}
							autoComplete="current-password"
							value={password}
							onChange={setPassword}
							show={showPassword}
						/>
						<ShowPasswordToggle checked={showPassword} onChange={setShowPassword} />
					</>
				)}

				{error && (
					<p role="alert" className="text-sm text-[var(--wc-paprika)]">
						{error}
					</p>
				)}

				<button
					type="submit"
					disabled={submitting}
					className="w-full rounded-full bg-[var(--wc-basil)] py-2.5 font-medium text-[var(--wc-bg)] transition-colors hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
				>
					{submitting ? t('auth.signingIn') : tempToken ? t('auth.verify') : t('nav.signIn')}
				</button>
				{tempToken && (
					<button
						type="button"
						onClick={() => {
							setTempToken(null)
							setCode('')
							setError(null)
						}}
						className="w-full text-sm text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]"
					>
						{t('common.cancel')}
					</button>
				)}
			</form>

			{GOOGLE_CLIENT_ID && !tempToken && (
				<div className="mt-6 space-y-4">
					<div className="flex items-center gap-3 text-xs uppercase text-[var(--wc-text-muted)]">
						<span className="h-px flex-1 bg-[var(--wc-border)]" />
						{t('auth.or')}
						<span className="h-px flex-1 bg-[var(--wc-border)]" />
					</div>
					<GoogleSignInButton onCredential={handleGoogle} />
				</div>
			)}

			<p className="mt-6 text-sm text-[var(--wc-text-muted)]">
				{t('auth.noAccount')}{' '}
				<Link to="/register" className="text-[var(--wc-saffron)] hover:underline">
					{t('nav.signUp')}
				</Link>
			</p>
		</div>
	)
}

export default Login
