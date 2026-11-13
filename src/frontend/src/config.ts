// Interruttori per funzionalità del frontend che dipendono da API non ancora pronte sul backend.
export const FEATURES = {
	// true quando POST/PATCH /api/recipes accettano il campo `visibility` (public | private | friends).
	// Finché è false il selettore è visibile ma il valore NON viene inviato (il backend potrebbe rifiutare campi sconosciuti).
	recipeVisibility: false,
}

// Client ID OAuth di Google (pubblico, non è un segreto). Va impostato anche lato backend come GOOGLE_CLIENT_ID.
// Se manca, il pulsante "Continua con Google" non viene mostrato.
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined

// Limiti upload allineati al backend (ADR 0029): foto ricette 10MB, video 50MB.
// L'avatar ha un limite proprio nel backend (avatar.multer.ts: 5MB).
export const UPLOAD_LIMITS = {
	imageMaxMb: 10,
	videoMaxMb: 50,
	avatarMaxMb: 5,
	galleryMax: 3,
	imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
	videoTypes: ['video/mp4', 'video/webm'],
}
