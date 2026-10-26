// Wrapper unico per tutte le chiamate verso il backend NestJS.
// Il backend espone le rotte sotto /api ed è configurato con setGlobalPrefix('api'),
// quindi qui basta passare il path relativo (es. "/recipes", "/auth/signin").

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

// le immagini/video caricati arrivano come path relativo (es. "/uploads/recipes/x.webp").
// Se il backend è su un altro host, impostare VITE_ASSET_BASE_URL (es. "http://localhost:3000").
const ASSET_BASE = (import.meta.env.VITE_ASSET_BASE_URL as string | undefined) ?? ''

export function assetUrl(path?: string | null): string | undefined {
	if (!path) return undefined
	if (/^(https?:)?\/\//.test(path) || path.startsWith('blob:') || path.startsWith('data:')) return path
	return `${ASSET_BASE}${path}`
}

// costruisce una query string saltando i valori vuoti: qs({ page: 1, search: '' }) -> "?page=1"
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
	const sp = new URLSearchParams()
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === '') continue
		sp.set(key, String(value))
	}
	const s = sp.toString()
	return s ? `?${s}` : ''
}

export function getErrorMessage(err: unknown, fallback: string): string {
	return err instanceof ApiError && err.message ? err.message : fallback
}

export class ApiError extends Error {
	status: number
	body: unknown

	constructor(status: number, message: string, body?: unknown) {
		super(message)
		this.status = status
		this.body = body
	}
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
	body?: unknown
	// se true, in caso di 401 tenta un refresh del token e ripete la richiesta una volta
	retryOnUnauthorized?: boolean
}

let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
	if (!refreshPromise) {
		refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
			method: 'POST',
			credentials: 'include',
		})
			.then((res) => res.ok)
			.catch(() => false)
			.finally(() => {
				refreshPromise = null
			})
	}
	return refreshPromise
}

export async function apiFetch<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
	const { body, retryOnUnauthorized = true, headers, ...rest } = options

	const isFormData = body instanceof FormData

	const doFetch = () =>
		fetch(`${API_BASE}${path}`, {
			...rest,
			credentials: 'include',
			headers: {
				...(isFormData ? {} : { 'Content-Type': 'application/json' }),
				...headers,
			},
			body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
		})

	let response = await doFetch()

	if (response.status === 401 && retryOnUnauthorized) {
		const refreshed = await tryRefresh()
		if (refreshed) {
			response = await doFetch()
		}
	}

	const contentType = response.headers.get('content-type') ?? ''
	const data = contentType.includes('application/json') ? await response.json().catch(() => null) : null

	if (!response.ok) {
		const message = (data && (data.message as string)) || response.statusText || 'Errore di rete'
		throw new ApiError(response.status, Array.isArray(message) ? message.join(', ') : message, data)
	}

	return data as T
}

export const api = {
	get: <T = unknown>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'GET' }),
	post: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
		apiFetch<T>(path, { ...options, method: 'POST', body }),
	patch: <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
		apiFetch<T>(path, { ...options, method: 'PATCH', body }),
	delete: <T = unknown>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: 'DELETE' }),
}

// il backend può rispondere con body vuoto / non JSON (api restituisce allora null):
// questo helper garantisce sempre un array, così le pagine non vanno in crash
export function asArray<T>(value: unknown): T[] {
	return Array.isArray(value) ? (value as T[]) : []
}

// alcune rotte admin possono rispondere con un array semplice o con { items, total_pages… }:
// questo helper le riporta sempre alla forma paginata
export function toPage<T>(data: unknown, fallbackLimit = 20): import('../types/models').Paginated<T> {
	if (Array.isArray(data)) {
		return {
			items: data as T[],
			total: data.length,
			page: 1,
			limit: Math.max(data.length, fallbackLimit),
			total_pages: 1,
			has_next_page: false,
			has_prev_page: false,
		}
	}
	const d = (data ?? {}) as Partial<import('../types/models').Paginated<T>>
	return {
		items: d.items ?? [],
		total: d.total ?? d.items?.length ?? 0,
		page: d.page ?? 1,
		limit: d.limit ?? fallbackLimit,
		total_pages: d.total_pages ?? 1,
		has_next_page: d.has_next_page ?? false,
		has_prev_page: d.has_prev_page ?? false,
	}
}
