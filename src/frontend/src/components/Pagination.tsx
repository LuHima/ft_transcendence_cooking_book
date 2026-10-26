import { useTranslation } from 'react-i18next'

interface PaginationProps {
	page: number
	totalPages: number
	onChange: (page: number) => void
}

function Pagination({ page, totalPages, onChange }: PaginationProps) {
	const { t } = useTranslation()
	if (totalPages <= 1) return null

	const btn =
		'rounded-full border border-[var(--wc-border)] px-4 py-1.5 text-sm text-[var(--wc-text)] transition-colors hover:border-[var(--wc-basil)] disabled:cursor-not-allowed disabled:opacity-40'

	return (
		<nav className="mt-8 flex items-center justify-center gap-4" aria-label={t('common.pagination')}>
			<button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
				← {t('common.prev')}
			</button>
			<span className="text-sm text-[var(--wc-text-muted)]">{t('common.pageOf', { page, total: totalPages })}</span>
			<button type="button" className={btn} disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
				{t('common.next')} →
			</button>
		</nav>
	)
}

export default Pagination
