import type { TFunction } from 'i18next'
import { UPLOAD_LIMITS } from '../config'

// validazione lato client (il backend ripete gli stessi controlli): restituisce il messaggio di errore o null.
// maxMb: limite specifico (es. UPLOAD_LIMITS.avatarMaxMb), altrimenti quello delle foto delle ricette
export function validateImage(file: File, t: TFunction, maxMb: number = UPLOAD_LIMITS.imageMaxMb): string | null {
	if (!UPLOAD_LIMITS.imageTypes.includes(file.type)) {
		return t('form.errors.imageType', { name: file.name })
	}
	if (file.size > maxMb * 1024 * 1024) {
		return t('form.errors.imageSize', { name: file.name, max: maxMb })
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
