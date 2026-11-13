import { useTranslation } from 'react-i18next'

function UploadProgress({ percent, label, className = '' }: { percent: number; label?: string; className?: string }) {
	const { t } = useTranslation()
	const value = Math.max(0, Math.min(100, Math.round(percent)))
	return (
		<div className={`space-y-1 ${className}`} aria-live="polite">
			<div className="flex justify-between gap-3 text-xs text-[var(--wc-text-muted)]">
				<span className="truncate">{label ?? t('form.uploadProgress')}</span>
				<span className="shrink-0 font-medium text-[var(--wc-text)]">{value}%</span>
			</div>
			<div
				role="progressbar"
				aria-label={label ?? t('form.uploadProgress')}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={value}
				className="h-2 w-full overflow-hidden rounded-full bg-[var(--wc-surface-raised)]"
			>
				<div className="h-full rounded-full bg-[var(--wc-basil)] transition-[width] duration-200" style={{ width: `${value}%` }} />
			</div>
		</div>
	)
}

export default UploadProgress
