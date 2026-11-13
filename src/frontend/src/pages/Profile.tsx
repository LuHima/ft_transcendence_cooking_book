import { useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, getErrorMessage, uploadWithProgress } from '../api/client'
import { UPLOAD_LIMITS } from '../config'
import { IMAGE_ACCEPT, validateImage } from '../lib/files'
import { useObjectUrl } from '../lib/useObjectUrl'
import { INPUT_CLASS, LABEL_CLASS, SUBMIT_CLASS } from '../lib/ui'
import Avatar from '../components/Avatar'
import LanguageSwitcher from '../components/LanguageSwitcher'
import TwoFactorSettings from '../components/TwoFactorSettings'
import BlockedUsers from '../components/BlockedUsers'
import UploadProgress from '../components/UploadProgress'
import { PROFILE_PRIVACIES, type AvatarUploadResponseDto, type ProfilePrivacy, type UpdateUserDto } from '../types/models'

// UpdateUserDto: bio is at most 500 characters
const BIO_MAX = 500

function Profile() {
	const { t } = useTranslation()
	const toast = useToast()
	const { user, refreshUser } = useAuth()
	const [username, setUsername] = useState(user?.username ?? '')
	const [email, setEmail] = useState(user?.email ?? '')
	const [bio, setBio] = useState(user?.bio ?? '')
	const [profilePrivacy, setProfilePrivacy] = useState<ProfilePrivacy>(user?.profile_privacy ?? 'public')
	const [avatarFile, setAvatarFile] = useState<File | null>(null)
	const [saving, setSaving] = useState(false)
	// Avatar upload progress (null = no upload in progress)
	const [avatarProgress, setAvatarProgress] = useState<number | null>(null)
	const fileRef = useRef<HTMLInputElement>(null)
	const preview = useObjectUrl(avatarFile)

	if (!user) return null

	function pickAvatar(file: File | undefined) {
		if (!file) return
		// Pre-flight check: type (jpeg/png/webp) and maximum avatar size
		const err = validateImage(file, t, UPLOAD_LIMITS.avatarMaxMb)
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
			if (avatarFile) {
				const formData = new FormData()
				formData.append('file', avatarFile)
				setAvatarProgress(0)
				try {
					await uploadWithProgress<AvatarUploadResponseDto>('/users/me/avatar', formData, (loaded, total) =>
						setAvatarProgress(total > 0 ? (loaded / total) * 100 : 0),
					)
				} finally {
					setAvatarProgress(null)
				}
				setAvatarFile(null)
			}
			// PATCH /users/me: only the changed fields are sent
			const patch: UpdateUserDto = {}
			if (username !== user?.username) patch.username = username
			if (email !== user?.email) patch.email = email
			if (bio.trim() !== (user?.bio ?? '')) patch.bio = bio.trim()
			if (profilePrivacy !== (user?.profile_privacy ?? 'public')) patch.profile_privacy = profilePrivacy
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
							accept={IMAGE_ACCEPT}
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
				{avatarFile && avatarProgress === null && (
					<p className="-mt-2 text-xs text-[var(--wc-text-muted)]">
						{t('profile.avatarPending', { max: UPLOAD_LIMITS.avatarMaxMb })}
					</p>
				)}
				{avatarProgress !== null && <UploadProgress percent={avatarProgress} label={t('profile.avatarUploading')} />}

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
					<label htmlFor="bio" className={LABEL_CLASS}>
						{t('profile.bio')}
					</label>
					<textarea
						id="bio"
						rows={4}
						maxLength={BIO_MAX}
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						placeholder={t('profile.bioPlaceholder')}
						className={INPUT_CLASS}
					/>
					<p className="mt-1 text-right text-xs text-[var(--wc-text-muted)]">
						{bio.length}/{BIO_MAX}
					</p>
				</div>

				<fieldset>
					<legend className={LABEL_CLASS}>{t('profile.privacy')}</legend>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
						{PROFILE_PRIVACIES.map((v) => (
							<label
								key={v}
								className={`cursor-pointer rounded-xl border px-3 py-2 text-sm transition-colors ${
									profilePrivacy === v
										? 'border-[var(--wc-basil)] bg-[var(--wc-surface-raised)]'
										: 'border-[var(--wc-border)] hover:border-[var(--wc-basil)]'
								}`}
							>
								<input
									type="radio"
									name="profile-privacy"
									value={v}
									checked={profilePrivacy === v}
									onChange={() => setProfilePrivacy(v)}
									className="sr-only"
								/>
								<span className="block font-medium text-[var(--wc-text)]">{t(`profilePrivacy.${v}`)}</span>
								<span className="block text-xs text-[var(--wc-text-muted)]">{t(`profilePrivacy.${v}Help`)}</span>
							</label>
						))}
					</div>
				</fieldset>

				<div>
					<label htmlFor="ui-lang" className={LABEL_CLASS}>
						{t('profile.language')}
					</label>
					{/* The User model has no `lang` field yet: the preference only applies to this browser */}
					<LanguageSwitcher variant="field" id="ui-lang" />
					<p className="mt-1 text-xs text-[var(--wc-text-muted)]">{t('profile.languageHelp')}</p>
				</div>

				<button type="submit" disabled={saving} className={SUBMIT_CLASS}>
					{saving ? t('common.saving') : t('form.saveChanges')}
				</button>
			</form>

			<TwoFactorSettings />

			<BlockedUsers />
		</div>
	)
}

export default Profile
