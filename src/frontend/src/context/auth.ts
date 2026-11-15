// Auth context object and hook, kept apart from <AuthProvider> (AuthContext.tsx) so that
// component files only export components (React Fast Refresh).
import { createContext, useContext } from 'react'
import type { User } from '../types/models'

export interface AuthContextValue {
	user: User | null
	// true until the existing session has been checked
	isLoading: boolean
	// With 2FA enabled the backend returns a tempToken, completed with the 6-digit code
	signIn: (email: string, password: string) => Promise<SignInResult>
	completeTwoFactor: (tempToken: string, code: string) => Promise<void>
	// Sign in (or sign up on first access) with a Google ID token, verified by the backend
	signInWithGoogle: (idToken: string) => Promise<SignInResult>
	signUp: (data: { username: string; email: string; password: string }) => Promise<void>
	signOut: () => Promise<void>
	refreshUser: () => Promise<void>
}

export type SignInResult = { twoFactor: false } | { twoFactor: true; tempToken: string }

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>')
	return ctx
}
