

export function wrapLongLines(text: string, maxLength = 30): string[] {
	const normalizedText = text.replace(/\s+/g, ' ').trim()
	if (!normalizedText) return []

	const lines: string[] = []
	let currentLine = ''

	for (const word of normalizedText.split(' ')) {
		const characters = Array.from(word)
		if (characters.length > maxLength) {
			if (currentLine) {
				lines.push(currentLine)
				currentLine = ''
			}

			while (characters.length > maxLength) {
				lines.push(`${characters.splice(0, maxLength - 1).join('')}-`)
			}
		}

		const remainingWord = characters.join('')
		if (!remainingWord) continue

		if (!currentLine) {
			currentLine = remainingWord
		} else if (Array.from(`${currentLine} ${remainingWord}`).length <= maxLength) {
			currentLine += ` ${remainingWord}`
		} else {
			lines.push(currentLine)
			currentLine = remainingWord
		}
	}

	if (currentLine) lines.push(currentLine)

	return lines
}
