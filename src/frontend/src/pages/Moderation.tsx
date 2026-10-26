import { useTranslation } from 'react-i18next'
import AdminReports from './admin/AdminReports'

// vista del moderatore: coda delle segnalazioni su utenti, commenti e ricette
function Moderation() {
	const { t } = useTranslation()
	return (
		<div className="mx-auto max-w-5xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('moderation.title')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('moderation.subtitle')}</p>
			<div className="mt-6">
				<AdminReports />
			</div>
		</div>
	)
}

export default Moderation
