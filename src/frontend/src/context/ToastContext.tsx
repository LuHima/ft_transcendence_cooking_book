import { useTranslation } from 'react-i18next'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
	id: number
	kind: ToastKind
	message: string
}

interface ToastApi {
	success: (message: string) => void
	error: (message: string) => void
	info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const DURATION_MS = 4500

const kindClass: Record<ToastKind, string> = {
	success: 'border-[var(--wc-basil)]',
	error: 'border-[var(--wc-paprika)]',
	info: 'border-[var(--wc-saffron)]',
}

const kindIcon: Record<ToastKind, string> = { success: '✓', error: '!', info: 'i' }

export function ToastProvider({ children }: { children: ReactNode }) {
	const { t: tr } = useTranslation()
	const [toasts, setToasts] = useState<ToastItem[]>([])
	const nextId = useRef(1)

	const dismiss = useCallback((id: number) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	const push = useCallback(
		(kind: ToastKind, message: string) => {
			const id = nextId.current++
			setToasts((prev) => [...prev.slice(-3), { id, kind, message }])
			window.setTimeout(() => dismiss(id), DURATION_MS)
		},
		[dismiss],
	)

	const api = useMemo<ToastApi>(
		() => ({
			success: (m) => push('success', m),
			error: (m) => push('error', m),
			info: (m) => push('info', m),
		}),
		[push],
	)

	return (
		<ToastContext.Provider value={api}>
			{children}
			{/* aria-live: gli screen reader leggono i nuovi toast senza spostare il focus */}
			<div
				aria-live="polite"
				className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
			>
				{toasts.map((t) => (
					<div
						key={t.id}
						role={t.kind === 'error' ? 'alert' : 'status'}
						className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-[var(--wc-surface)] px-4 py-3 text-sm text-[var(--wc-text)] shadow-lg ${kindClass[t.kind]}`}
					>
						<span aria-hidden="true" className="mt-0.5 font-bold">
							{kindIcon[t.kind]}
						</span>
						<p className="flex-1 break-words">{t.message}</p>
						<button
							type="button"
							onClick={() => dismiss(t.id)}
							aria-label={tr('common.close')}
							className="text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]"
						>
							×
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	)
}

export function useToast(): ToastApi {
	const ctx = useContext(ToastContext)
	if (!ctx) throw new Error('useToast deve essere usato dentro <ToastProvider>')
	return ctx
}
