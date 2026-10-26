import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, getErrorMessage } from '../api/client'
import { SUPPORTED_LANGS } from '../i18n'
import { validateImage } from '../lib/files'
import { useLang } from '../lib/useLang'
import { useObjectUrl } from '../lib/useObjectUrl'
import { INPUT_CLASS, LABEL_CLASS, SUBMIT_CLASS } from '../lib/ui'
import Avatar from '../components/Avatar'
import TwoFactorSettings from '../components/TwoFactorSettings'

function Profile() {
	const { t, i18n } = useTranslation()
	const lang = useLang()
	const toast = useToast()
	const { user, refreshUser } = useAuth()
	const [username, setUsername] = useState(user?.username ?? '')
	const [email, setEmail] = useState(user?.email ?? '')
	const [avatarFile, setAvatarFile] = useState<File | null>(null)
	const [saving, setSaving] = useState(false)
	const fileRef = useRef<HTMLInputElement>(null)
	const preview = useObjectUrl(avatarFile)

	if (!user) return null

	function pickAvatar(file: File | undefined) {
		if (!file) return
		const err = validateImage(file, t)
		if (err) return toast.error(err)
		setAvatarFile(file)
	}

	async function removeAvatar() {
		try {
			await api.delete('/users/me/avatar')
			setAvatarFile(null)
			await refreshUser()
			toast.success(t('profile.avatarRemoved'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('profile.avatarError')))
		}
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setSaving(true)
		try {
			// POST /users/me/avatar (multipart, campo "file")
			if (avatarFile) {
				const formData = new FormData()
				formData.append('file', avatarFile)
				await api.post('/users/me/avatar', formData)
				setAvatarFile(null)
			}
			// PATCH /users/me: si inviano solo i campi cambiati
			const patch: Record<string, string> = {}
			if (username !== user?.username) patch.username = username
			if (email !== user?.email) patch.email = email
			if (Object.keys(patch).length > 0) await api.patch('/users/me', patch)
			await refreshUser()
			toast.success(t('profile.saved'))
		} catch (err) {
			toast.error(getErrorMessage(err, t('form.errors.saveFailed')))
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="mx-auto max-w-xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('nav.profile')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('profile.intro')}</p>

			<form onSubmit={handleSubmit} className="mt-8 space-y-5">
				<div className="flex items-center gap-4">
					{preview ? (
						<img src={preview} alt="" className="h-16 w-16 rounded-full object-cover" />
					) : (
						<Avatar username={user.username} url={user.avatar_url} className="h-16 w-16 text-xl" />
					)}
					<div className="flex flex-wrap items-center gap-3">
						<input
							ref={fileRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							aria-label={t('profile.changeAvatar')}
							className="hidden"
							onChange={(e) => {
								pickAvatar(e.target.files?.[0])
								e.target.value = ''
							}}
						/>
						<button
							type="button"
							onClick={() => fileRef.current?.click()}
							className="rounded-full border border-[var(--wc-border)] px-4 py-2 text-sm hover:border-[var(--wc-basil)]"
						>
							{t('profile.changeAvatar')}
						</button>
						{user.avatar_url && !avatarFile && (
							<button type="button" onClick={removeAvatar} className="text-sm text-[var(--wc-paprika)] hover:underline">
								{t('common.remove')}
							</button>
						)}
					</div>
				</div>

				<div>
					<label htmlFor="username" className={LABEL_CLASS}>
						Username
					</label>
					<input id="username" minLength={3} maxLength={30} value={username} onChange={(e) => setUsername(e.target.value)} className={INPUT_CLASS} />
				</div>

				<div>
					<label htmlFor="email" className={LABEL_CLASS}>
						Email
					</label>
					<input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} />
				</div>

				<div>
					<label htmlFor="ui-lang" className={LABEL_CLASS}>
						{t('profile.language')}
					</label>
					{/* NB: il modello User non ha ancora un campo `lang`: per ora la preferenza vale solo su questo browser */}
					<select id="ui-lang" value={lang} onChange={(e) => void i18n.changeLanguage(e.target.value)} className={`${INPUT_CLASS} h-[42px]`}>
						{SUPPORTED_LANGS.map((l) => (
							<option key={l} value={l}>
								{t(`lang.${l}`)}
							</option>
						))}
					</select>
					<p className="mt-1 text-xs text-[var(--wc-text-muted)]">{t('profile.languageHelp')}</p>
				</div>

				<button type="submit" disabled={saving} className={SUBMIT_CLASS}>
					{saving ? t('common.saving') : t('form.saveChanges')}
				</button>
			</form>

			<TwoFactorSettings />
		</div>
	)
}

export default Profile
