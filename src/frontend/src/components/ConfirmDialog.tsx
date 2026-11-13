import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

interface ConfirmDialogProps {
	title: string
	children?: ReactNode
	confirmLabel: string
	danger?: boolean
	// If set, the user must type this text to enable the confirm button
	requireText?: string
	onConfirm: () => Promise<void> | void
	onClose: () => void
}

// Accessible confirmation dialog, used instead of window.confirm for important actions
function ConfirmDialog({ title, children, confirmLabel, danger = false, requireText, onConfirm, onClose }: ConfirmDialogProps) {
	const { t } = useTranslation()
	const [busy, setBusy] = useState(false)
	const [typed, setTyped] = useState('')
	const enabled = !requireText || typed.trim() === requireText

	async function confirm() {
		setBusy(true)
		try {
			await onConfirm()
		} finally {
			setBusy(false)
		}
	}

	return (
		<div
			className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4"
			role="alertdialog"
			aria-modal="true"
			aria-label={title}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget && !busy) onClose()
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape' && !busy) onClose()
			}}
		>
			<div className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6">
				<h2 className={`font-display text-2xl ${danger ? 'text-[var(--wc-paprika)]' : 'text-[var(--wc-saffron)]'}`}>{title}</h2>
				{children && <div className="space-y-2 text-sm text-[var(--wc-text)]">{children}</div>}
				{requireText && (
					<label className="block text-sm text-[var(--wc-text-muted)]">
						{t('common.typeToConfirm', { text: requireText })}
						<input
							autoFocus
							value={typed}
							onChange={(e) => setTyped(e.target.value)}
							className="mt-1 w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm text-[var(--wc-text)] outline-none focus:border-[var(--wc-paprika)]"
						/>
					</label>
				)}
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						disabled={busy}
						className="rounded-full border border-[var(--wc-border)] px-4 py-2 text-sm hover:border-[var(--wc-basil)] disabled:opacity-60"
					>
						{t('common.cancel')}
					</button>
					<button
						type="button"
						autoFocus={!requireText}
						onClick={() => void confirm()}
						disabled={busy || !enabled}
						className={`rounded-full px-5 py-2 text-sm font-medium text-[var(--wc-bg)] disabled:opacity-60 ${
							danger ? 'bg-[var(--wc-paprika)]' : 'bg-[var(--wc-basil)] hover:bg-[var(--wc-basil-dark)]'
						}`}
					>
						{busy ? t('common.sending') : confirmLabel}
					</button>
				</div>
			</div>
		</div>
	)
}

export default ConfirmDialog
