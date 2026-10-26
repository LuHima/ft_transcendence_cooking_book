import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import it from './locales/it.json'
import en from './locales/en.json'
import fr from './locales/fr.json'
import type { Lang } from '../types/models'

export const SUPPORTED_LANGS: Lang[] = ['it', 'en', 'fr']
export const LANG_STORAGE_KEY = 'wecook.lang'

export function normalizeLang(value?: string | null): Lang {
	const base = (value ?? '').slice(0, 2).toLowerCase()
	return (SUPPORTED_LANGS as string[]).includes(base) ? (base as Lang) : 'it'
}

void i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources: { it: { translation: it }, en: { translation: en }, fr: { translation: fr } },
		supportedLngs: SUPPORTED_LANGS,
		nonExplicitSupportedLngs: true,
		load: 'languageOnly',
		fallbackLng: 'it',
		interpolation: { escapeValue: false },
		detection: {
			order: ['localStorage', 'navigator'],
			lookupLocalStorage: LANG_STORAGE_KEY,
			caches: ['localStorage'],
		},
	})

// tiene allineato <html lang> con la lingua scelta (accessibilità + traduzione del browser)
function syncHtmlLang(lng: string) {
	if (typeof document !== 'undefined') document.documentElement.lang = normalizeLang(lng)
}
syncHtmlLang(i18n.language)
i18n.on('languageChanged', syncHtmlLang)

export default i18n
