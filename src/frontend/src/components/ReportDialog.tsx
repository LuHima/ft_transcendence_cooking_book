import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, getErrorMessage } from '../api/client'
import type { ReportReason, ReportTarget } from '../types/models'

const REASONS: ReportReason[] = ['spam', 'offensive', 'inappropriate', 'copyright', 'other']
const MAX_DETAILS = 500

interface ReportDialogProps {
	targetType: ReportTarget
	targetId: number
	onClose: () => void
}

function ReportDialog({ targetType, targetId, onClose }: ReportDialogProps) {
	const { t } = useTranslation()
	const toast = useToast()
	const [reason, setReason] = useState<ReportReason>('inappropriate')
	const [details, setDetails] = useState('')
	const [submitting, setSubmitting] = useState(false)

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		setSubmitting(true)
		try {
			// NB: endpoint da esporre lato backend: POST /reports { target_type, target_id, reason, details? }
			await api.post('/reports', {
				target_type: targetType,
				target_id: targetId,
				reason,
				...(details.trim() ? { details: details.trim() } : {}),
			})
			toast.success(t('report.sent'))
			onClose()
		} catch (err) {
			toast.error(getErrorMessage(err, t('report.error')))
			setSubmitting(false)
		}
	}

	return (
		<div
			className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
			role="dialog"
			aria-modal="true"
			aria-label={t('report.title')}
			onMouseDown={(e) => {
				if (e.target === e.currentTarget) onClose()
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onClose()
			}}
		>
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-md space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-bg)] p-6"
			>
				<h2 className="font-display text-2xl text-[var(--wc-saffron)]">{t('report.title')}</h2>
				<p className="text-sm text-[var(--wc-text-muted)]">{t(`report.intro.${targetType}`)}</p>

				<fieldset className="space-y-2">
					<legend className="mb-1 text-sm text-[var(--wc-text-muted)]">{t('report.reason')}</legend>
					{REASONS.map((r) => (
						<label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--wc-text)]">
							<input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
							{t(`report.reasons.${r}`)}
						</label>
					))}
				</fieldset>

				<div>
					<label htmlFor="report-details" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						{t('report.details')}
					</label>
					<textarea
						id="report-details"
						rows={3}
						maxLength={MAX_DETAILS}
						value={details}
						onChange={(e) => setDetails(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
					/>
				</div>

				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="rounded-full border border-[var(--wc-border)] px-4 py-2 text-sm hover:border-[var(--wc-basil)]"
					>
						{t('common.cancel')}
					</button>
					<button
						type="submit"
						disabled={submitting}
						className="rounded-full bg-[var(--wc-paprika)] px-5 py-2 text-sm font-medium text-[var(--wc-bg)] disabled:opacity-60"
					>
						{submitting ? t('common.sending') : t('report.submit')}
					</button>
				</div>
			</form>
		</div>
	)
}

interface ReportButtonProps {
	targetType: ReportTarget
	targetId: number
	// id del proprietario del contenuto: non si segnalano i propri contenuti
	ownerId?: number | null
	className?: string
}

// pulsante "Segnala": visibile solo agli utenti loggati che non sono i proprietari del contenuto
export function ReportButton({ targetType, targetId, ownerId, className = '' }: ReportButtonProps) {
	const { t } = useTranslation()
	const { user } = useAuth()
	const [open, setOpen] = useState(false)

	if (!user || ownerId === user.id) return null

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={`text-xs text-[var(--wc-text-muted)] hover:text-[var(--wc-paprika)] hover:underline ${className}`}
			>
				⚑ {t('report.button')}
			</button>
			{open && <ReportDialog targetType={targetType} targetId={targetId} onClose={() => setOpen(false)} />}
		</>
	)
}

export default ReportDialog
