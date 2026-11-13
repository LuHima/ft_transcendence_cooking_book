import { useTranslation } from 'react-i18next'
import { normalizeLang } from '../i18n'
import type { Lang } from '../types/models'

// Current interface language (it | en | fr), to pass as ?lang= to the API
export function useLang(): Lang {
	const { i18n } = useTranslation()
	return normalizeLang(i18n.resolvedLanguage ?? i18n.language)
}
