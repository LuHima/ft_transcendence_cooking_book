import { useTranslation } from 'react-i18next'

interface PaginationProps {
	page: number
	totalPages: number
	onChange: (page: number) => void
	// Server flags (has_prev_page / has_next_page): when given they take precedence over page/totalPages
	hasPrev?: boolean
	hasNext?: boolean
	// Spacing above the controls (default mt-8)
	className?: string
}

function Pagination({ page, totalPages, onChange, hasPrev, hasNext, className = 'mt-8' }: PaginationProps) {
	const { t } = useTranslation()
	const canPrev = hasPrev ?? page > 1
	const canNext = hasNext ?? page < totalPages
	if (totalPages <= 1 && !canPrev && !canNext) return null

	const btn =
		'rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm text-[var(--wc-text)] transition-colors hover:border-[var(--wc-basil)] disabled:cursor-not-allowed disabled:opacity-40'

	return (
		<nav className={`${className} flex items-center justify-center gap-4`} aria-label={t('common.pagination')}>
			<button type="button" className={btn} disabled={!canPrev} onClick={() => onChange(page - 1)}>
				← {t('common.prev')}
			</button>
			<span className="text-sm text-[var(--wc-text-muted)]">{t('common.pageOf', { page, total: Math.max(totalPages, page) })}</span>
			<button type="button" className={btn} disabled={!canNext} onClick={() => onChange(page + 1)}>
				{t('common.next')} →
			</button>
		</nav>
	)
}

export default Pagination
