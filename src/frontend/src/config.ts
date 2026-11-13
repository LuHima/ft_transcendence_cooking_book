// Client ID OAuth di Google (pubblico, non è un segreto). Va impostato anche lato backend come GOOGLE_CLIENT_ID.
// Se manca, il pulsante "Continua con Google" non viene mostrato.
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined

// Limiti upload allineati al backend (ADR 0029): 
// foto ricette e avatar 10MB, video 50MB.
export const UPLOAD_LIMITS = {
	imageMaxMb: 10,
	videoMaxMb: 50,
	avatarMaxMb: 10,
	galleryMax: 3,
	imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
	videoTypes: ['video/mp4', 'video/webm'],
}
