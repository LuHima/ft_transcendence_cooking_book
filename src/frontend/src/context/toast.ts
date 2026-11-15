// Toast context object and hook, kept apart from <ToastProvider> (ToastContext.tsx) so that
// component files only export components (React Fast Refresh).
import { createContext, useContext } from 'react'

export interface ToastApi {
	success: (message: string) => void
	error: (message: string) => void
	info: (message: string) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
	const ctx = useContext(ToastContext)
	if (!ctx) throw new Error('useToast deve essere usato dentro <ToastProvider>')
	return ctx
}
