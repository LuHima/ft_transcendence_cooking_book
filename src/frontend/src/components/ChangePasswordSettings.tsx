import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../context/toast'
import { api, getErrorMessage } from '../api/client'
import PasswordInput from './PasswordInput'
import ShowPasswordToggle from './ShowPasswordToggle'

// Endpoint for the password change. The old password is NOT required,
// so the same form works for Google accounts and email/password accounts.
//   PATCH /users/me/password { password } -> 200/204
const CHANGE_PASSWORD_ENDPOINT = '/users/me/password'

// Same rules as signup (SignupUserDto): 9-72 chars, uppercase, lowercase, number or symbol
function isStrongPassword(value: string): boolean {
	return value.length >= 9 && value.length <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[\d\W_]/.test(value)
}

function ChangePasswordSettings() {
	const { t } = useTranslation()
	const toast = useToast()
	const [password, setPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [show, setShow] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const mismatch = confirm.length > 0 && confirm !== password

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setError(null)
		if (password !== confirm) return setError(t('auth.passwordMismatch'))
		if (!isStrongPassword(password)) return setError(t('auth.passwordHelp'))
		setBusy(true)
		try {
			await api.patch(CHANGE_PASSWORD_ENDPOINT, { password })
			toast.success(t('changePassword.successToast'))
			setPassword('')
			setConfirm('')
			setShow(false)
		} catch (err) {
			setError(getErrorMessage(err, t('changePassword.error')))
		} finally {
			setBusy(false)
		}
	}

	return (
		<section className="mt-10 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-5">
			<h2 className="font-display text-xl text-[var(--wc-saffron)]">{t('changePassword.title')}</h2>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('changePassword.intro')}</p>
			<form onSubmit={handleSubmit} className="mt-4 space-y-3">
				<PasswordInput
					id="new-password"
					label={t('changePassword.newPassword')}
					autoComplete="new-password"
					minLength={9}
					value={password}
					onChange={setPassword}
					show={show}
					hint={t('auth.passwordHelp')}
				/>
				<PasswordInput
					id="confirm-new-password"
					label={t('changePassword.confirmNewPassword')}
					autoComplete="new-password"
					minLength={9}
					value={confirm}
					onChange={setConfirm}
					show={show}
					invalid={mismatch}
					error={mismatch ? t('auth.passwordMismatch') : undefined}
				/>
				<ShowPasswordToggle id="change-password-show" checked={show} onChange={setShow} />
				{error && (
					<p role="alert" className="text-sm text-[var(--wc-paprika)]">
						{error}
					</p>
				)}
				<button
					type="submit"
					disabled={busy || !password || mismatch}
					className="rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
				>
					{busy ? t('common.saving') : t('changePassword.submit')}
				</button>
			</form>
		</section>
	)
}

export default ChangePasswordSettings
