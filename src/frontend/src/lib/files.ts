import type { TFunction } from 'i18next'
import { UPLOAD_LIMITS } from '../config'

// validazione lato client (il backend ripete gli stessi controlli): restituisce il messaggio di errore o null
export function validateImage(file: File, t: TFunction): string | null {
	if (!UPLOAD_LIMITS.imageTypes.includes(file.type)) {
		return t('form.errors.imageType', { name: file.name })
	}
	if (file.size > UPLOAD_LIMITS.imageMaxMb * 1024 * 1024) {
		return t('form.errors.imageSize', { name: file.name, max: UPLOAD_LIMITS.imageMaxMb })
	}
	return null
}

export function validateVideo(file: File, t: TFunction): string | null {
	if (!UPLOAD_LIMITS.videoTypes.includes(file.type)) {
		return t('form.errors.videoType', { name: file.name })
	}
	if (file.size > UPLOAD_LIMITS.videoMaxMb * 1024 * 1024) {
		return t('form.errors.videoSize', { name: file.name, max: UPLOAD_LIMITS.videoMaxMb })
	}
	return null
}
