import type { AvailableLanguage, Lang, TranslationSource } from '../types/models'

// colori del badge di provenienza della traduzione (usati in RecipeDetail e RecipeForm)
export const PROVENANCE_STYLE: Record<TranslationSource, string> = {
	author_original: 'border-[var(--wc-basil)] text-[var(--wc-basil)]',
	manual: 'border-[var(--wc-saffron)] text-[var(--wc-saffron)]',
	machine: 'border-[var(--wc-border)] text-[var(--wc-text-muted)]',
}

// provenienza di una lingua: la lingua originale è sempre del testo dell'autore;
// null = la lingua non è ancora stata tradotta
export function provenanceOf(
	locale: Lang,
	sourceLang: Lang,
	available: AvailableLanguage[] | undefined,
): TranslationSource | null {
	if (locale === sourceLang) return 'author_original'
	return available?.find((a) => a.locale === locale)?.translation_source ?? null
}
