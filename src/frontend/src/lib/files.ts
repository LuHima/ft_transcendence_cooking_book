import type { TFunction } from 'i18next'
import { UPLOAD_LIMITS } from '../config'

// alcuni browser/sistemi lasciano vuoto file.type (es. .webp): in quel caso si guarda l'estensione
const IMAGE_EXTENSIONS: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const VIDEO_EXTENSIONS: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm' }

function mimeOf(file: File, byExtension: Record<string, string>): string {
	if (file.type) return file.type
	const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
	return byExtension[ext] ?? ''
}

// valore per l'attributo accept dei file picker: tipi MIME + estensioni (JPEG, PNG e WebP)
export const IMAGE_ACCEPT = [...UPLOAD_LIMITS.imageTypes, '.jpg', '.jpeg', '.png', '.webp'].join(',')
export const VIDEO_ACCEPT = [...UPLOAD_LIMITS.videoTypes, '.mp4', '.webm'].join(',')

// validazione lato client (il backend ripete gli stessi controlli): restituisce il messaggio di errore o null.
// maxMb: limite specifico (es. UPLOAD_LIMITS.avatarMaxMb), altrimenti quello delle foto delle ricette
export function validateImage(file: File, t: TFunction, maxMb: number = UPLOAD_LIMITS.imageMaxMb): string | null {
	if (!UPLOAD_LIMITS.imageTypes.includes(mimeOf(file, IMAGE_EXTENSIONS))) {
		return t('form.errors.imageType', { name: file.name })
	}
	if (file.size > maxMb * 1024 * 1024) {
		return t('form.errors.imageSize', { name: file.name, max: maxMb })
	}
	return null
}

export function validateVideo(file: File, t: TFunction): string | null {
	if (!UPLOAD_LIMITS.videoTypes.includes(mimeOf(file, VIDEO_EXTENSIONS))) {
		return t('form.errors.videoType', { name: file.name })
	}
	if (file.size > UPLOAD_LIMITS.videoMaxMb * 1024 * 1024) {
		return t('form.errors.videoSize', { name: file.name, max: UPLOAD_LIMITS.videoMaxMb })
	}
	return null
}
