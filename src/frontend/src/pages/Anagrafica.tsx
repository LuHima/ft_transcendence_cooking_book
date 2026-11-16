import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/auth'
import { useToast } from '../context/toast'
import { api, getErrorMessage } from '../api/client'
import { INPUT_CLASS, LABEL_CLASS, SUBMIT_CLASS } from '../lib/ui'
import DateInput from '../components/DateInput'

function field(value: string | null | undefined) {
	return value ?? ''
}

// Phone: 7–15 digits, optional leading "+", optional "(+prefix)", separators: spaces ( ) . -
const PHONE_RE = /^(?=(?:\D*\d){7,15}\D*$)(?:\+\s?)?(?:\(\+?\d{1,5}\)|\d)[\d\s().-]*\d$/
// Postal code: 3–10 alphanumerics with at least one digit, single "-" or space between them
const POSTAL_RE = /^(?=.*\d)[A-Za-z0-9](?:[A-Za-z0-9]|[- ](?=[A-Za-z0-9])){1,8}[A-Za-z0-9]$/
// City: letters only (any alphabet, accents included); single space, apostrophe or hyphen allowed between words
const CITY_RE = /^\p{L}+(?:[ '’-]\p{L}+)*$/u

// Characters that can never appear in a valid value are dropped while typing
const sanitize = {
	phone: (v: string) => v.replace(/[^\d\s+().-]/g, ''),
	postal_code: (v: string) => v.replace(/[^A-Za-z0-9 -]/g, ''),
	city: (v: string) => v.replace(/[^\p{L} '’-]/gu, ''),
}

type CheckedField = keyof typeof sanitize

const PATTERNS: Record<CheckedField, RegExp> = { phone: PHONE_RE, postal_code: POSTAL_RE, city: CITY_RE }

// Empty is allowed: every field on this page is optional
function isValid(key: CheckedField, value: string) {
	const v = value.trim()
	return v === '' || PATTERNS[key].test(v)
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
	// remounts DateInput after "clear" (it keeps day/month/year in its own state)
	const [birthKey, setBirthKey] = useState(0)
	// errors are shown only after the user leaves the field (or tries to submit)
	const [touched, setTouched] = useState<Record<CheckedField, boolean>>({ phone: false, postal_code: false, city: false })

	if (!user) return null

	function update<K extends keyof typeof form>(key: K, value: string) {
		setForm((prev) => ({ ...prev, [key]: value }))
	}

	const invalid: Record<CheckedField, boolean> = {
		phone: !isValid('phone', form.phone),
		postal_code: !isValid('postal_code', form.postal_code),
		city: !isValid('city', form.city),
	}
	const showError = (key: CheckedField) => touched[key] && invalid[key]
	const touch = (key: CheckedField) => setTouched((prev) => ({ ...prev, [key]: true }))

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (!birthValid) return toast.error(t('personal.birthInvalid'))
		if (invalid.phone || invalid.postal_code || invalid.city) {
			setTouched({ phone: true, postal_code: true, city: true })
			return toast.error(t('personal.fixErrors'))
		}
		setSaving(true)
		try {
			// Empty birth date: '' clears a previously saved one (the backend stores null); omitted if there was none
			const { birth_date, ...fields } = form
			const rest = { ...fields, phone: fields.phone.trim(), postal_code: fields.postal_code.trim(), city: fields.city.trim() }
			const hadBirthDate = Boolean(user?.birth_date)
			await api.patch('/users/me', { ...rest, ...(birth_date ? { birth_date } : hadBirthDate ? { birth_date: '' } : {}) })
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
						<input id="first_name" autoComplete="given-name" maxLength={100} value={form.first_name} onChange={(e) => update('first_name', e.target.value)} className={INPUT_CLASS} />
					</div>
					<div>
						<label htmlFor="last_name" className={LABEL_CLASS}>{t('personal.lastName')}</label>
						<input id="last_name" autoComplete="family-name" maxLength={100} value={form.last_name} onChange={(e) => update('last_name', e.target.value)} className={INPUT_CLASS} />
					</div>
				</div>
				<div>
					<DateInput
						key={birthKey}
						id="birth_date"
						label={t('personal.birthDate')}
						value={form.birth_date}
						onChange={(iso, valid) => {
							update('birth_date', iso)
							setBirthValid(valid)
						}}
					/>
					{(form.birth_date || user.birth_date) && (
						<button
							type="button"
							onClick={() => {
								update('birth_date', '')
								setBirthValid(true)
								setBirthKey((k) => k + 1)
							}}
							className="mt-1 text-xs text-[var(--wc-saffron)] hover:underline"
						>
							{t('personal.clearBirthDate')}
						</button>
					)}
				</div>
				<div>
					<label htmlFor="phone" className={LABEL_CLASS}>{t('personal.phone')}</label>
					<input
						id="phone"
						type="tel"
						inputMode="tel"
						autoComplete="tel"
						maxLength={30}
						value={form.phone}
						onChange={(e) => update('phone', sanitize.phone(e.target.value))}
						onBlur={() => touch('phone')}
						aria-invalid={showError('phone')}
						aria-describedby={showError('phone') ? 'phone-error' : undefined}
						className={INPUT_CLASS}
					/>
					{showError('phone') && (
						<p id="phone-error" role="alert" className="mt-1 text-xs text-[var(--wc-paprika)]">{t('personal.phoneInvalid')}</p>
					)}
				</div>
				<div>
					<label htmlFor="address" className={LABEL_CLASS}>{t('personal.address')}</label>
					<input id="address" autoComplete="street-address" maxLength={255} value={form.address} onChange={(e) => update('address', e.target.value)} className={INPUT_CLASS} />
				</div>
				<div className="grid grid-cols-2 gap-4">
					<div>
						<label htmlFor="city" className={LABEL_CLASS}>{t('personal.city')}</label>
						<input
							id="city"
							autoComplete="address-level2"
							maxLength={100}
							value={form.city}
							onChange={(e) => update('city', sanitize.city(e.target.value))}
							onBlur={() => touch('city')}
							aria-invalid={showError('city')}
							aria-describedby={showError('city') ? 'city-error' : undefined}
							className={INPUT_CLASS}
						/>
						{showError('city') && (
							<p id="city-error" role="alert" className="mt-1 text-xs text-[var(--wc-paprika)]">{t('personal.cityInvalid')}</p>
						)}
					</div>
					<div>
						<label htmlFor="postal_code" className={LABEL_CLASS}>{t('personal.postalCode')}</label>
						<input
							id="postal_code"
							autoComplete="postal-code"
							maxLength={10}
							value={form.postal_code}
							onChange={(e) => update('postal_code', sanitize.postal_code(e.target.value))}
							onBlur={() => touch('postal_code')}
							aria-invalid={showError('postal_code')}
							aria-describedby={showError('postal_code') ? 'postal_code-error' : undefined}
							className={INPUT_CLASS}
						/>
						{showError('postal_code') && (
							<p id="postal_code-error" role="alert" className="mt-1 text-xs text-[var(--wc-paprika)]">{t('personal.postalCodeInvalid')}</p>
						)}
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
