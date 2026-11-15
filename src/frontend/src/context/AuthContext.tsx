import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api/client'
import type { User } from '../types/models'
import { AuthContext, type SignInResult } from './auth'


// Browser hint telling whether this device had a session. It holds no sensitive data:
// tokens stay in httpOnly cookies. Guests skip the startup request, so no 401s in the console.
//   '1'  = session found last time → fetch /users/me on startup (with token refresh)
//   '0'  = guest → no request on startup
//   null = never checked → check once and store the result
const SESSION_HINT_KEY = 'wecook.session'

function readSessionHint(): string | null {
	try {
		return localStorage.getItem(SESSION_HINT_KEY)
	} catch {
		return null
	}
}

function writeSessionHint(active: boolean) {
	try {
		localStorage.setItem(SESSION_HINT_KEY, active ? '1' : '0')
	} catch {
		// localStorage unavailable (e.g. strict private browsing): continue without the hint
	}
}

// Only one /users/me request at a time (StrictMode runs effects twice in development)
let meRequest: Promise<User | null> | null = null

function fetchMe(): Promise<User | null> {
	if (!meRequest) {
		meRequest = api
			// If the 10-minute access token expired, the client refreshes it with the 7-day one
			.get<User>('/users/me')
			.then((me) => me ?? null)
			.catch(() => null)
			.finally(() => {
				meRequest = null
			})
	}
	return meRequest
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(() => readSessionHint() !== '0')

	// Loads the signed-in user from the cookie and updates the session hint
	const refreshUser = useCallback(async () => {
		const me = await fetchMe()
		setUser(me)
		writeSessionHint(me !== null)
	}, [])

	// On startup, known guests skip the request entirely.
	// State is only set in the async callbacks (the request is shared, so StrictMode's double run is harmless).
	useEffect(() => {
		if (readSessionHint() === '0') return
		let cancelled = false
		fetchMe()
			.then((me) => {
				if (cancelled) return
				setUser(me)
				writeSessionHint(me !== null)
			})
			.finally(() => {
				if (!cancelled) setIsLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [])

	const signIn = useCallback(
		async (email: string, password: string): Promise<SignInResult> => {
			const res = await api.post<{ tempToken?: string; twofAuth?: boolean } | null>(
				'/auth/signin',
				{ email, password },
				{ retryOnUnauthorized: false },
			)
			if (res?.twofAuth && res.tempToken) return { twoFactor: true, tempToken: res.tempToken }
			await refreshUser()
			return { twoFactor: false }
		},
		[refreshUser],
	)

	const signInWithGoogle = useCallback(
		async (idToken: string): Promise<SignInResult> => {
			const res = await api.post<{ tempToken?: string; twofAuth?: boolean } | null>(
				'/auth/signin/google',
				{ idToken },
				{ retryOnUnauthorized: false },
			)
			if (res?.twofAuth && res.tempToken) return { twoFactor: true, tempToken: res.tempToken }
			await refreshUser()
			return { twoFactor: false }
		},
		[refreshUser],
	)

	const completeTwoFactor = useCallback(
		async (tempToken: string, code: string) => {
			await api.post('/auth/twofactor/access', { tempToken, code }, { retryOnUnauthorized: false })
			await refreshUser()
		},
		[refreshUser],
	)

	const signUp = useCallback(async (data: { username: string; email: string; password: string }) => {
		await api.post('/auth/signup', data, { retryOnUnauthorized: false })
	}, [])

	const signOut = useCallback(async () => {
		try {
			await api.delete('/auth/signout', { retryOnUnauthorized: false })
		} catch (err) {
			// An already-expired token is fine: local state is cleared anyway
			if (!(err instanceof ApiError)) throw err
		}
		writeSessionHint(false)
		setUser(null)
	}, [])

	return (
		<AuthContext.Provider value={{ user, isLoading, signIn, signInWithGoogle, completeTwoFactor, signUp, signOut, refreshUser }}>
			{children}
		</AuthContext.Provider>
	)
}
