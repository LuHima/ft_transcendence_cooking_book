import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from '../api/client'
import type { User } from '../types/models'

interface AuthContextValue {
	user: User | null
	// true finché non abbiamo ancora controllato se esiste una sessione valida
	isLoading: boolean
	signIn: (email: string, password: string) => Promise<void>
	signUp: (data: { username: string; email: string; password: string }) => Promise<void>
	signOut: () => Promise<void>
	refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(true)

	// si appoggia a GET /api/users/me per recuperare l'utente loggato dal cookie.
	// se questa rotta non è ancora pronta sul backend, la app funziona comunque:
	// semplicemente non viene ripristinata la sessione al refresh della pagina finché
	// non viene aggiunta lato server.
	const refreshUser = useCallback(async () => {
		try {
			const me = await api.get<User>('/users/me', { retryOnUnauthorized: false })
			setUser(me)
		} catch {
			setUser(null)
		}
	}, [])

	useEffect(() => {
		refreshUser().finally(() => setIsLoading(false))
	}, [refreshUser])

	const signIn = useCallback(
		async (email: string, password: string) => {
			await api.post('/auth/signin', { email, password }, { retryOnUnauthorized: false })
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
			// se il token era già scaduto non è un problema: si pulisce comunque lo stato locale
			if (!(err instanceof ApiError)) throw err
		}
		setUser(null)
	}, [])

	return (
		<AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, refreshUser }}>
			{children}
		</AuthContext.Provider>
	)
}

export function useAuth() {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>')
	return ctx
}
