import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS } from '../i18n'
import { useLang } from '../lib/useLang'
import type { Lang } from '../types/models'

const LABELS: Record<Lang, string> = { it: 'IT', en: 'EN', fr: 'FR' }

// selettore della lingua dell'interfaccia; la scelta è salvata in localStorage da i18next
function LanguageSwitcher({ className = '' }: { className?: string }) {
	const { t, i18n } = useTranslation()
	const lang = useLang()

	return (
		<select
			value={lang}
			onChange={(e) => void i18n.changeLanguage(e.target.value)}
			aria-label={t('common.language')}
			className={`rounded-full border border-[var(--wc-border)] bg-[var(--wc-surface)] px-2 py-1.5 text-sm text-[var(--wc-text)] outline-none hover:border-[var(--wc-basil)] focus:border-[var(--wc-basil)] ${className}`}
		>
			{SUPPORTED_LANGS.map((l) => (
				<option key={l} value={l}>
					{LABELS[l]}
				</option>
			))}
		</select>
	)
}

export default LanguageSwitcher
