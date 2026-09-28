

export function wrapLongLines(text: string, maxLength = 30): string[] {
	// Normalizza gli spazi bianchi e rimuove eventuali spazi iniziali o finali
    // /\s+/g significa "uno o più spazi bianchi" e li sostituisce con un singolo spazio
	// la g serve per fare la sostituzione globalmente su tutta la stringa
	// trim() rimuove eventuali spazi bianchi all'inizio e alla fine della stringa
	const normalizedText = text.replace(/\s+/g, ' ').trim()
	const lines: string[] = []

	// Divide il testo in linee di lunghezza massima maxLength
	for (let index = 0; index < normalizedText.length; index += maxLength) {
		const line = normalizedText.slice(index, index + maxLength)
		lines.push(index + maxLength < normalizedText.length ? `${line}-` : line)
	}

	return lines
}
