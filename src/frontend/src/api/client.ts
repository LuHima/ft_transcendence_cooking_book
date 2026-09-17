// Wrapper unico per tutte le chiamate verso il backend NestJS.
// Il backend espone le rotte sotto /api ed è configurato con setGlobalPrefix('api'),
// quindi qui basta passare il path relativo (es. "/recipes", "/auth/signin").

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

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
