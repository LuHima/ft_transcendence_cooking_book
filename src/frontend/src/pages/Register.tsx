import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../api/client'
import { INPUT_CLASS, LABEL_CLASS } from '../lib/ui'
import PasswordInput from '../components/PasswordInput'
import ShowPasswordToggle from '../components/ShowPasswordToggle'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { getAccountBannedDetails } from '../lib/accountBanned'
import { GOOGLE_CLIENT_ID } from '../config'

function Register() {
	const { t } = useTranslation()
	const { signUp, signIn, signInWithGoogle } = useAuth()
	const navigate = useNavigate()
	// Page the user came from (e.g. the "Add recipe" form), forwarded by the login page
	const fromState = (useLocation().state as { from?: { pathname: string } } | null)?.from
	const from = fromState?.pathname ?? '/'

	const [username, setUsername] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [accepted, setAccepted] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		if (password !== confirm) {
			setError(t('auth.passwordMismatch'))
			return
		}
		setSubmitting(true)
		try {
			await signUp({ username, email, password })
			try {
				await signIn(email, password)
				navigate(from, { replace: true })
			} catch {
				navigate('/login', { state: { registered: true, from: fromState } })
			}
		} catch (err) {
			setError(getErrorMessage(err, t('auth.registerError')))
		} finally {
			setSubmitting(false)
		}
	}

	// Google sign-up/sign-in still requires accepting the terms and privacy policy
	async function handleGoogle(idToken: string) {
		setError(null)
		if (!accepted) {
			setError(t('auth.acceptTermsFirst'))
			return
		}
		try {
			const result = await signInWithGoogle(idToken)
			if (result.twoFactor) {
				// 2FA is completed on the login page
				navigate('/login', { state: { tempToken: result.tempToken, from: fromState } })
				return
			}
			navigate(from, { replace: true })
		} catch (err) {
			// Banned Google account: the ban details card is shown on the login page
			const banned = getAccountBannedDetails(err)
			if (banned) {
				navigate('/login', { state: { banned } })
				return
			}
			setError(getErrorMessage(err, t('auth.googleError')))
		}
	}

	return (
		<div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('auth.createAccount')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('auth.registerIntro')}</p>

			<form onSubmit={handleSubmit} className="mt-8 space-y-4">
				<div>
					<label htmlFor="username" className={LABEL_CLASS}>
						Username
					</label>
					<input
						id="username"
						type="text"
						required
						minLength={3}
						maxLength={30}
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						className={INPUT_CLASS}
					/>
				</div>
				<div>
					<label htmlFor="email" className={LABEL_CLASS}>
						Email
					</label>
					<input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
				</div>
				<PasswordInput
					id="password"
					label="Password"
					autoComplete="new-password"
					minLength={9}
					value={password}
					onChange={setPassword}
					show={showPassword}
					hint={t('auth.passwordHelp')}
				/>
				<PasswordInput
					id="confirm-password"
					label={t('auth.confirmPassword')}
					autoComplete="new-password"
					minLength={9}
					value={confirm}
					onChange={setConfirm}
					show={showPassword}
					invalid={confirm.length > 0 && confirm !== password}
					error={confirm.length > 0 && confirm !== password ? t('auth.passwordMismatch') : undefined}
				/>
				<ShowPasswordToggle checked={showPassword} onChange={setShowPassword} />

				<label className="flex items-start gap-2 text-sm text-[var(--wc-text-muted)]">
					<input type="checkbox" required checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
					<span>
						{t('auth.acceptTermsPrefix')}{' '}
						<Link to="/terms" target="_blank" className="text-[var(--wc-saffron)] hover:underline">
							{t('footer.terms')}
						</Link>{' '}
						{t('auth.acceptTermsAnd')}{' '}
						<Link to="/privacy" target="_blank" className="text-[var(--wc-saffron)] hover:underline">
							{t('nav.privacy')}
						</Link>
					</span>
				</label>

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
					{submitting ? t('auth.creating') : t('nav.signUp')}
				</button>
			</form>

			{GOOGLE_CLIENT_ID && (
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
				{t('auth.haveAccount')}{' '}
				<Link to="/login" state={fromState ? { from: fromState } : undefined} className="text-[var(--wc-saffron)] hover:underline">
					{t('nav.signIn')}
				</Link>
			</p>
		</div>
	)
}

export default Register
