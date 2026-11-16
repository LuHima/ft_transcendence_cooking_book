import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/auth'
import { useToast } from '../context/toast'
import { api, getErrorMessage } from '../api/client'
import PasswordInput from './PasswordInput'
import ShowPasswordToggle from './ShowPasswordToggle'
import GoogleSignInButton from './GoogleSignInButton'

// Dual re-authentication password endpoint (ADR-0036):
//   PATCH /auth/password { currentPassword?, idToken?, newPassword } -> 200
const CHANGE_PASSWORD_ENDPOINT = '/auth/password'

// Same rules as signup (SignUpUserDto): 9-72 chars, uppercase, lowercase, number or symbol
function isStrongPassword(value: string): boolean {
	return value.length >= 9 && value.length <= 72 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /[\d\W_]/.test(value)
}

function ChangePasswordSettings() {
	const { t } = useTranslation()
	const toast = useToast()
	const { user, refreshUser } = useAuth()
	const hasPassword = user?.has_password !== false
	const isGoogleLinked = Boolean(user?.is_google_linked)

	const [currentPassword, setCurrentPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirm, setConfirm] = useState('')
	const [show, setShow] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const mismatch = confirm.length > 0 && confirm !== newPassword
	const canSubmitNewPassword = Boolean(newPassword) && !mismatch

	function validateNewPassword(): boolean {
		setError(null)
		if (newPassword !== confirm) {
			setError(t('auth.passwordMismatch'))
			return false
		}
		if (!isStrongPassword(newPassword)) {
			setError(t('auth.passwordHelp'))
			return false
		}
		return true
	}

	async function submitPasswordChange(body: { currentPassword?: string; idToken?: string }) {
		if (!validateNewPassword()) return
		setBusy(true)
		try {
			await api.patch(CHANGE_PASSWORD_ENDPOINT, {
				...body,
				newPassword,
			})
			toast.success(hasPassword ? t('changePassword.successToast') : t('changePassword.setToast'))
			setCurrentPassword('')
			setNewPassword('')
			setConfirm('')
			setShow(false)
			await refreshUser()
		} catch (err) {
			setError(getErrorMessage(err, body.idToken ? t('changePassword.googleError') : t('changePassword.error')))
		} finally {
			setBusy(false)
		}
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (!hasPassword) return
		await submitPasswordChange({ currentPassword })
	}

	return (
		<section className="mt-10 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-5">
			<h2 className="font-display text-xl text-[var(--wc-saffron)]">
				{hasPassword ? t('changePassword.title') : t('changePassword.setTitle')}
			</h2>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">
				{hasPassword ? t('changePassword.intro') : t('changePassword.setIntro')}
			</p>
			<form onSubmit={handleSubmit} className="mt-4 space-y-3">
				<PasswordInput
					id="new-password"
					label={t('changePassword.newPassword')}
					autoComplete="new-password"
					minLength={9}
					value={newPassword}
					onChange={setNewPassword}
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
				{hasPassword && (
					<PasswordInput
						id="current-password"
						label={t('changePassword.currentPassword')}
						autoComplete="current-password"
						minLength={9}
						value={currentPassword}
						onChange={setCurrentPassword}
						show={show}
					/>
				)}
				<ShowPasswordToggle id="change-password-show" checked={show} onChange={setShow} />
				{error && (
					<p role="alert" className="text-sm text-[var(--wc-paprika)]">
						{error}
					</p>
				)}
				{hasPassword && (
					<button
						type="submit"
						disabled={busy || !canSubmitNewPassword || !currentPassword}
						className="rounded-full bg-[var(--wc-basil)] px-4 py-2 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)] disabled:opacity-60"
					>
						{busy ? t('common.saving') : t('changePassword.submit')}
					</button>
				)}
				{(isGoogleLinked || !hasPassword) && (
					<div className="space-y-3 pt-1">
						{hasPassword && (
							<div className="flex items-center gap-3 text-xs uppercase tracking-wider text-[var(--wc-text-muted)]">
								<span className="h-px flex-1 bg-[var(--wc-border)]" />
								<span>{t('auth.or')}</span>
								<span className="h-px flex-1 bg-[var(--wc-border)]" />
							</div>
						)}
						<p className="text-sm text-[var(--wc-text)]">{t('changePassword.confirmWithGoogle')}</p>
						<div className={canSubmitNewPassword && !busy ? 'flex justify-start' : 'pointer-events-none flex justify-start opacity-50'}>
							<GoogleSignInButton onCredential={(idToken) => submitPasswordChange({ idToken })} />
						</div>
					</div>
				)}
			</form>
		</section>
	)
}

export default ChangePasswordSettings
