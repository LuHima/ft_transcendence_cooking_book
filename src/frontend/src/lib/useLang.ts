import { useTranslation } from 'react-i18next'
import { normalizeLang } from '../i18n'
import type { Lang } from '../types/models'

// lingua corrente dell'interfaccia (it | en | fr): da passare come ?lang= alle API
export function useLang(): Lang {
	const { i18n } = useTranslation()
	return normalizeLang(i18n.resolvedLanguage ?? i18n.language)
}
