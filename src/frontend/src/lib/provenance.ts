import type { AvailableLanguage, Lang, TranslationSource } from '../types/models'

// Translation provenance badge colours (RecipeDetail and RecipeForm)
export const PROVENANCE_STYLE: Record<TranslationSource, string> = {
	author_original: 'border-[var(--wc-basil)] text-[var(--wc-basil)]',
	manual: 'border-[var(--wc-saffron)] text-[var(--wc-saffron)]',
	machine: 'border-[var(--wc-border)] text-[var(--wc-text-muted)]',
}

// Provenance of a language: the source language is always the author's original text;
// null = not translated yet
export function provenanceOf(
	locale: Lang,
	sourceLang: Lang,
	available: AvailableLanguage[] | undefined,
): TranslationSource | null {
	if (locale === sourceLang) return 'author_original'
	return available?.find((a) => a.locale === locale)?.translation_source ?? null
}
