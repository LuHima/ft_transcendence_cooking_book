// Google OAuth client ID (public, not a secret); must match GOOGLE_CLIENT_ID on the backend.
// Without it the "Continue with Google" button is hidden.
export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined

// Upload limits aligned with the backend (ADR 0029): recipe photos and avatars 10 MB, videos 50 MB
export const UPLOAD_LIMITS = {
	imageMaxMb: 10,
	videoMaxMb: 50,
	avatarMaxMb: 10,
	galleryMax: 3,
	imageTypes: ['image/jpeg', 'image/png', 'image/webp'],
	videoTypes: ['video/mp4', 'video/webm'],
}
