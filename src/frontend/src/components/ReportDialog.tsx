import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { api, ApiError, getErrorMessage } from '../api/client'
import { REPORT_REASONS, type CreateReportDto, type ReportReason, type ReportSubject } from '../types/models'

// CreateReportDto: description max 1000 caratteri
const MAX_DESCRIPTION = 1000

interface ReportDialogProps {
	targetType: ReportSubject
	targetId: number
	onClose: () => void
}

function ReportDialog({ targetType, targetId, onClose }: ReportDialogProps) {
	const { t } = useTranslation()
	const toast = useToast()
	// nessuna motivazione preselezionata: l'utente deve sceglierla esplicitamente
	const [reason, setReason] = useState<ReportReason | null>(null)
	const [description, setDescription] = useState('')
	const [submitting, setSubmitting] = useState(false)

	async function handleSubmit(e: FormEvent) {
		e.preventDefault()
		if (!reason) return
		setSubmitting(true)
		try {
			// POST /api/reports (CreateReportDto)
			const body: CreateReportDto = {
				subject: targetType,
				target_id: targetId,
				reason,
				...(description.trim() ? { description: description.trim() } : {}),
			}
			await api.post('/reports', body)
			toast.success(t('report.sent'))
			onClose()
		} catch (err) {
			// 409 = esiste già una segnalazione in attesa per questo contenuto
			toast.error(err instanceof ApiError && err.status === 409 ? t('report.alreadyReported') : getErrorMessage(err, t('report.error')))
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
					{REPORT_REASONS.map((r) => (
						<label key={r} className="flex cursor-pointer items-center gap-2 text-sm text-[var(--wc-text)]">
							<input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
							{t(`report.reasons.${r}`)}
						</label>
					))}
				</fieldset>

				<div>
					<label htmlFor="report-description" className="mb-1 block text-sm text-[var(--wc-text-muted)]">
						{t('report.details')}
					</label>
					<textarea
						id="report-description"
						rows={3}
						maxLength={MAX_DESCRIPTION}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						className="w-full rounded-lg border border-[var(--wc-border)] bg-[var(--wc-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--wc-basil)]"
					/>
					<p className="mt-1 text-right text-xs text-[var(--wc-text-muted)]">
						{description.length}/{MAX_DESCRIPTION}
					</p>
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
						disabled={submitting || !reason}
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
	targetType: ReportSubject
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
