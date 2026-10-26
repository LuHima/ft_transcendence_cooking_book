import type { Ref } from 'react'
import { INPUT_CLASS, LABEL_CLASS } from '../lib/ui'

interface PasswordInputProps {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	// true = testo in chiaro (gestito dal checkbox "Mostra password" della pagina)
	show: boolean
	autoComplete?: string
	minLength?: number
	invalid?: boolean
	inputRef?: Ref<HTMLInputElement>
	hint?: string
	error?: string
}

// campo password con il tipo controllato da fuori: più campi (password + conferma) condividono un solo checkbox
function PasswordInput({ id, label, value, onChange, show, autoComplete, minLength, invalid, inputRef, hint, error }: PasswordInputProps) {
	return (
		<div>
			<label htmlFor={id} className={LABEL_CLASS}>
				{label}
			</label>
			<input
				id={id}
				ref={inputRef}
				type={show ? 'text' : 'password'}
				required
				minLength={minLength}
				autoComplete={autoComplete}
				aria-invalid={invalid || undefined}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className={`${INPUT_CLASS} ${invalid ? 'border-[var(--wc-paprika)]' : ''}`}
			/>
			{hint && <p className="mt-1 text-xs text-[var(--wc-text-muted)]">{hint}</p>}
			{error && <p className="mt-1 text-xs text-[var(--wc-paprika)]">{error}</p>}
		</div>
	)
}

export default PasswordInput
