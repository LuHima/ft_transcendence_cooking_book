import type { TFunction } from 'i18next'
import { assetUrl } from '../api/client'
import type { RecipeDetail } from '../types/models'

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 18
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const FOOTER_SPACE = 14
const MM_PER_POINT = 0.3528
const LINE_SPACING = 1.4

const TEXT_COLOR = '#2b2620'
const MUTED_COLOR = '#6f6556'
const ACCENT_COLOR = '#a96f14'
const STEP_COLOR = '#5f7a41'

type PdfImage = { data: string; width: number; height: number }

// Ingredient notes are JSON on the backend: show them only when they are plain text
export function ingredientNote(notes: unknown): string | null {
	return typeof notes === 'string' && notes.trim() ? notes.trim() : null
}

export function formatQuantity(n: number): string {
	return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

// Standard PDF fonts only cover Windows-1252: emojis and other symbols would print as garbage
function printable(text: string): string {
	return text
		.normalize('NFC')
		.replace(/[^\n\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/gu, '')
		.replace(/[ \t]+\n/g, '\n')
		.trim()
}

function fileName(title: string): string {
	const slug = title
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
	return `${slug || 'ricetta'}.pdf`
}

// A missing photo must not block the export: the recipe is exported without it
async function loadImage(path: string | null | undefined, aspectRatio?: number): Promise<PdfImage | null> {
	const url = assetUrl(path)
	if (!url) return null
	try {
		const response = await fetch(url, { credentials: 'include' })
		if (!response.ok) return null
		const bitmap = await createImageBitmap(await response.blob())

		let sourceWidth = bitmap.width
		let sourceHeight = bitmap.height
		if (aspectRatio) {
			if (sourceWidth / sourceHeight > aspectRatio) sourceWidth = sourceHeight * aspectRatio
			else sourceHeight = sourceWidth / aspectRatio
		}
		const scale = Math.min(1, 1400 / sourceWidth)
		const canvas = document.createElement('canvas')
		canvas.width = Math.round(sourceWidth * scale)
		canvas.height = Math.round(sourceHeight * scale)
		const ctx = canvas.getContext('2d')
		if (!ctx) return null
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, canvas.width, canvas.height)
		ctx.drawImage(
			bitmap,
			(bitmap.width - sourceWidth) / 2,
			(bitmap.height - sourceHeight) / 2,
			sourceWidth,
			sourceHeight,
			0,
			0,
			canvas.width,
			canvas.height,
		)
		bitmap.close()
		return { data: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height }
	} catch {
		return null
	}
}

export async function exportRecipePdf(recipe: RecipeDetail, t: TFunction): Promise<void> {
	// jsPDF is loaded lazily so it doesn't weigh on the rest of the site
	const { jsPDF } = await import('jspdf')

	const steps = [...recipe.steps].sort((a, b) => a.step_number - b.step_number)
	const [cover, ...stepImages] = await Promise.all([
		loadImage(recipe.cover_image_url, 16 / 9),
		...steps.map((step) => loadImage(step.image_url)),
	])

	const doc = new jsPDF({ unit: 'mm', format: 'a4' })
	doc.setProperties({ title: printable(recipe.title), creator: 'WeCook' })
	let y = MARGIN

	const lineHeight = (size: number) => size * MM_PER_POINT * LINE_SPACING

	function ensureSpace(height: number) {
		if (y + height <= PAGE_HEIGHT - FOOTER_SPACE) return
		doc.addPage()
		y = MARGIN
	}

	function writeText(
		text: string,
		options: { size?: number; style?: 'normal' | 'bold'; color?: string; x?: number; width?: number } = {},
	) {
		const { size = 11, style = 'normal', color = TEXT_COLOR, x = MARGIN, width = CONTENT_WIDTH } = options
		const clean = printable(text)
		if (!clean) return
		doc.setFont('helvetica', style)
		doc.setFontSize(size)
		doc.setTextColor(color)
		const height = lineHeight(size)
		// splitTextToSize also wraps words wider than the line
		for (const line of doc.splitTextToSize(clean, width) as string[]) {
			ensureSpace(height)
			doc.text(line, x, y + size * MM_PER_POINT)
			y += height
		}
	}

	function writeHeading(text: string) {
		ensureSpace(22)
		y += 6
		writeText(text, { size: 15, style: 'bold', color: ACCENT_COLOR })
		y += 2
	}

	function writeImage(image: PdfImage, x: number, maxWidth: number, maxHeight: number) {
		const scale = Math.min(maxWidth / image.width, maxHeight / image.height)
		const width = image.width * scale
		const height = image.height * scale
		ensureSpace(height + 3)
		doc.addImage(image.data, 'JPEG', x, y, width, height)
		y += height + 3
	}

	if (cover) writeImage(cover, MARGIN, CONTENT_WIDTH, 95)

	writeText(recipe.title, { size: 24, style: 'bold' })
	y += 1
	writeText(`${t('recipe.publishedBy')}: ${recipe.author?.username ?? t('recipe.platformName')}`, { size: 10, color: MUTED_COLOR })
	writeText(
		[
			`${t('recipe.course')}: ${t(`course.${recipe.course}`)}`,
			`${t('recipe.difficulty')}: ${t(`difficulty.${recipe.difficulty}`)}`,
			`${t('recipe.servings')}: ${recipe.servings}`,
		].join('   |   '),
		{ size: 10, color: MUTED_COLOR },
	)
	writeText(
		[
			`${t('recipe.prepTime')}: ${t('recipe.minutes', { count: recipe.prep_time })}`,
			`${t('recipe.cookTime')}: ${t('recipe.minutes', { count: recipe.cook_time })}`,
			t('recipe.totalTime', { count: recipe.total_time }),
		].join('   |   '),
		{ size: 10, color: MUTED_COLOR },
	)
	if (recipe.tags.length > 0) {
		writeText(recipe.tags.map((tag) => tag.name).join(', '), { size: 10, color: MUTED_COLOR })
	}

	y += 4
	writeText(recipe.description)

	writeHeading(t('recipe.ingredients'))
	if (recipe.ingredients.length === 0) writeText(t('recipe.noIngredients'), { color: MUTED_COLOR })
	const quantityWidth = 30
	for (const ingredient of recipe.ingredients) {
		const note = ingredientNote(ingredient.notes)
		const name = printable(note ? `${ingredient.name} (${note})` : ingredient.name)
		const nameWidth = CONTENT_WIDTH - quantityWidth
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(11)
		const nameLines = (doc.splitTextToSize(name, nameWidth) as string[]).length
		ensureSpace(nameLines * lineHeight(11))
		const rowStart = y
		writeText(`${formatQuantity(ingredient.quantity)} ${t(`unit.${ingredient.unit}`)}`, { color: MUTED_COLOR, width: quantityWidth - 3 })
		const quantityEnd = y
		y = rowStart
		writeText(name, { x: MARGIN + quantityWidth, width: nameWidth })
		y = Math.max(y, quantityEnd) + 0.8
	}

	writeHeading(t('recipe.preparation'))
	const stepIndent = 11
	steps.forEach((step, index) => {
		ensureSpace(16)
		doc.setFillColor(STEP_COLOR)
		doc.circle(MARGIN + 3.5, y + 3, 3.5, 'F')
		doc.setFont('helvetica', 'bold')
		doc.setFontSize(9)
		doc.setTextColor('#ffffff')
		doc.text(String(step.step_number), MARGIN + 3.5, y + 4.1, { align: 'center' })

		const textOptions = { x: MARGIN + stepIndent, width: CONTENT_WIDTH - stepIndent }
		if (step.title) writeText(step.title, { ...textOptions, style: 'bold' })
		writeText(step.description, textOptions)
		if (step.duration != null && step.duration > 0) {
			writeText(t('recipe.minutes', { count: step.duration }), { ...textOptions, size: 9, color: MUTED_COLOR })
		}
		const image = stepImages[index]
		if (image) {
			y += 2
			writeImage(image, textOptions.x, textOptions.width, 70)
		}
		y += 4
	})

	if (recipe.tips) {
		writeHeading(t('recipe.tips'))
		writeText(recipe.tips)
	}
	if (recipe.preservation) {
		writeHeading(t('recipe.preservation'))
		writeText(recipe.preservation)
	}

	const pages = doc.getNumberOfPages()
	for (let page = 1; page <= pages; page += 1) {
		doc.setPage(page)
		doc.setFont('helvetica', 'normal')
		doc.setFontSize(9)
		doc.setTextColor(MUTED_COLOR)
		doc.text('WeCook', MARGIN, PAGE_HEIGHT - 8)
		doc.text(`${page} / ${pages}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: 'right' })
	}

	doc.save(fileName(recipe.title))
}
