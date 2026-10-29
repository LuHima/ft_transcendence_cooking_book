import { useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { INPUT_CLASS } from '../lib/ui'

interface DateInputProps {
	id?: string
	label: string
	// data iniziale in formato ISO (YYYY-MM-DD) o vuota
	value: string
	// chiamato a ogni modifica: `iso` è YYYY-MM-DD solo se la data è completa e valida, altrimenti ''
	// `valid` è false se il campo è compilato solo in parte o contiene una data inesistente
	onChange: (iso: string, valid: boolean) => void
	minYear?: number
}

const digits = (s: string) => s.replace(/\D/g, '')

function daysIn(month: number, year: number) {
	return new Date(year, month, 0).getDate()
}

function check(d: string, m: string, y: string, minYear: number): { iso: string; valid: boolean } {
	if (!d && !m && !y) return { iso: '', valid: true }
	if (d.length === 0 || m.length === 0 || y.length !== 4) return { iso: '', valid: false }
	const dn = Number(d)
	const mn = Number(m)
	const yn = Number(y)
	const maxYear = new Date().getFullYear()
	if (mn < 1 || mn > 12 || yn < minYear || yn > maxYear || dn < 1 || dn > daysIn(mn, yn)) return { iso: '', valid: false }
	const iso = `${y}-${String(mn).padStart(2, '0')}-${String(dn).padStart(2, '0')}`
	// non nel futuro
	if (new Date(iso).getTime() > Date.now()) return { iso: '', valid: false }
	return { iso, valid: true }
}

// data di nascita senza calendario: tre caselle GG / MM / AAAA con salto automatico alla successiva
function DateInput({ id = 'date', label, value, onChange, minYear = 1900 }: DateInputProps) {
	const { t } = useTranslation()
	const [y0 = '', m0 = '', d0 = ''] = value ? value.split('-') : []
	const [day, setDay] = useState(d0)
	const [month, setMonth] = useState(m0)
	const [year, setYear] = useState(y0)
	const [touched, setTouched] = useState(false)
	const monthRef = useRef<HTMLInputElement>(null)
	const yearRef = useRef<HTMLInputElement>(null)
	const dayRef = useRef<HTMLInputElement>(null)

	function emit(d: string, m: string, y: string) {
		const r = check(d, m, y, minYear)
		onChange(r.iso, r.valid)
	}

	function onDay(e: ChangeEvent<HTMLInputElement>) {
		let v = digits(e.target.value).slice(0, 2)
		// prima cifra > 3: il giorno è di una cifra sola (es. 5 → 05)
		if (v.length === 1 && Number(v) > 3) v = `0${v}`
		setDay(v)
		setTouched(true)
		emit(v, month, year)
		if (v.length === 2) monthRef.current?.focus()
	}
	function onMonth(e: ChangeEvent<HTMLInputElement>) {
		let v = digits(e.target.value).slice(0, 2)
		if (v.length === 1 && Number(v) > 1) v = `0${v}`
		setMonth(v)
		setTouched(true)
		emit(day, v, year)
		if (v.length === 2) yearRef.current?.focus()
	}
	function onYear(e: ChangeEvent<HTMLInputElement>) {
		const v = digits(e.target.value).slice(0, 4)
		setYear(v)
		setTouched(true)
		emit(day, month, v)
	}

	// "/" . - e spazio fanno passare alla casella successiva; Backspace su casella vuota torna alla precedente
	function handleKey(e: KeyboardEvent<HTMLInputElement>, field: 'day' | 'month' | 'year', current: string) {
		const order = { day: [null, monthRef], month: [dayRef, yearRef], year: [monthRef, null] } as const
		const [prev, next] = order[field]
		if (['/', '.', '-', ' '].includes(e.key)) {
			e.preventDefault()
			if (current) next?.current?.focus()
		} else if (e.key === 'Backspace' && current === '') {
			prev?.current?.focus()
		}
	}

	const { valid } = check(day, month, year, minYear)
	const showError = touched && !valid
	const box = `${INPUT_CLASS} !px-1 text-center`

	return (
		<div role="group" aria-labelledby={`${id}-label`}>
			<span id={`${id}-label`} className="mb-1 block text-sm text-[var(--wc-text-muted)]">
				{label}
			</span>
			<div className="flex items-center gap-2">
				<input
					id={id}
					ref={dayRef}
					inputMode="numeric"
					autoComplete="bday-day"
					placeholder={t('personal.dayPh')}
					aria-label={t('personal.day')}
					aria-invalid={showError}
					value={day}
					onChange={onDay}
					onKeyDown={(e) => handleKey(e, 'day', day)}
					className={`${box} !w-14`}
				/>
				<span aria-hidden="true" className="text-[var(--wc-text-muted)]">/</span>
				<input
					ref={monthRef}
					inputMode="numeric"
					autoComplete="bday-month"
					placeholder={t('personal.monthPh')}
					aria-label={t('personal.month')}
					aria-invalid={showError}
					value={month}
					onChange={onMonth}
					onKeyDown={(e) => handleKey(e, 'month', month)}
					className={`${box} !w-14`}
				/>
				<span aria-hidden="true" className="text-[var(--wc-text-muted)]">/</span>
				<input
					ref={yearRef}
					inputMode="numeric"
					autoComplete="bday-year"
					placeholder={t('personal.yearPh')}
					aria-label={t('personal.year')}
					aria-invalid={showError}
					value={year}
					onChange={onYear}
					onKeyDown={(e) => handleKey(e, 'year', year)}
					className={`${box} !w-20`}
				/>
			</div>
			{showError && (
				<p role="alert" className="mt-1 text-xs text-[var(--wc-paprika)]">
					{t('personal.birthInvalid')}
				</p>
			)}
		</div>
	)
}

export default DateInput
