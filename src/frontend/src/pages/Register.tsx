import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../api/client'
import { INPUT_CLASS, LABEL_CLASS } from '../lib/ui'
import PasswordInput from '../components/PasswordInput'
import ShowPasswordToggle from '../components/ShowPasswordToggle'

function Register() {
	const { t } = useTranslation()
	const { signUp, signIn } = useAuth()
	const navigate = useNavigate()

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
				navigate('/', { replace: true })
			} catch {
				navigate('/login', { state: { registered: true } })
			}
		} catch (err) {
			setError(getErrorMessage(err, t('auth.registerError')))
		} finally {
			setSubmitting(false)
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

			<p className="mt-6 text-sm text-[var(--wc-text-muted)]">
				{t('auth.haveAccount')}{' '}
				<Link to="/login" className="text-[var(--wc-saffron)] hover:underline">
					{t('nav.signIn')}
				</Link>
			</p>
		</div>
	)
}

export default Register
