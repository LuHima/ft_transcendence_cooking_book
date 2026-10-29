import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, getErrorMessage } from '../api/client'
import { INPUT_CLASS, LABEL_CLASS, SUBMIT_CLASS } from '../lib/ui'
import DateInput from '../components/DateInput'

function field(value: string | null | undefined) {
	return value ?? ''
}

function Anagrafica() {
	const { t } = useTranslation()
	const toast = useToast()
	const { user, refreshUser } = useAuth()
	const [form, setForm] = useState({
		first_name: field(user?.first_name),
		last_name: field(user?.last_name),
		birth_date: field(user?.birth_date?.slice(0, 10)),
		phone: field(user?.phone),
		address: field(user?.address),
		city: field(user?.city),
		postal_code: field(user?.postal_code),
	})
	const [saving, setSaving] = useState(false)
	const [birthValid, setBirthValid] = useState(true)

	if (!user) return null

	function update<K extends keyof typeof form>(key: K, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }))
	}

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (!birthValid) return toast.error(t('personal.birthInvalid'))
		setSaving(true)
		try {
			// una data di nascita vuota non è valida per il backend: si omette
			const { birth_date, ...rest } = form
			await api.patch('/users/me', { ...rest, ...(birth_date ? { birth_date } : {}) })
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
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('nav.personalData')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('personal.intro')}</p>

			<form onSubmit={handleSubmit} className="mt-8 space-y-5">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="first_name" className={LABEL_CLASS}>{t('personal.firstName')}</label>
						<input id="first_name" maxLength={100} value={form.first_name} onChange={(e) => update('first_name', e.target.value)} className={INPUT_CLASS} />
					</div>
					<div>
						<label htmlFor="last_name" className={LABEL_CLASS}>{t('personal.lastName')}</label>
						<input id="last_name" maxLength={100} value={form.last_name} onChange={(e) => update('last_name', e.target.value)} className={INPUT_CLASS} />
					</div>
				</div>
				<div>
					<DateInput
						id="birth_date"
						label={t('personal.birthDate')}
						value={form.birth_date}
						onChange={(iso, valid) => {
							update('birth_date', iso)
							setBirthValid(valid)
						}}
					/>
				</div>
				<div>
					<label htmlFor="phone" className={LABEL_CLASS}>{t('personal.phone')}</label>
					<input id="phone" maxLength={30} value={form.phone} onChange={(e) => update('phone', e.target.value)} className={INPUT_CLASS} />
				</div>
				<div>
					<label htmlFor="address" className={LABEL_CLASS}>{t('personal.address')}</label>
					<input id="address" maxLength={255} value={form.address} onChange={(e) => update('address', e.target.value)} className={INPUT_CLASS} />
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="city" className={LABEL_CLASS}>{t('personal.city')}</label>
						<input id="city" maxLength={100} value={form.city} onChange={(e) => update('city', e.target.value)} className={INPUT_CLASS} />
					</div>
					<div>
						<label htmlFor="postal_code" className={LABEL_CLASS}>{t('personal.postalCode')}</label>
						<input id="postal_code" maxLength={10} value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)} className={INPUT_CLASS} />
					</div>
				</div>

				<button type="submit" disabled={saving} className={SUBMIT_CLASS}>
					{saving ? t('common.saving') : t('form.saveChanges')}
				</button>
			</form>
		</div>
	)
}

export default Anagrafica
