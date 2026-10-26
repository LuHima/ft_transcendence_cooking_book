import { useTranslation } from 'react-i18next'

interface Props {
	checked: boolean
	onChange: (checked: boolean) => void
	id?: string
}

function ShowPasswordToggle({ checked, onChange, id = 'show-password' }: Props) {
	const { t } = useTranslation()
	return (
		<label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--wc-text-muted)]">
			<input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
			{t('auth.showPassword')}
		</label>
	)
}

export default ShowPasswordToggle
