import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdminReports from './admin/AdminReports'
import AdminRecipes from './admin/AdminRecipes'
import AdminComments from './admin/AdminComments'

type Tab = 'reports' | 'recipes' | 'comments'
const TABS: Tab[] = ['reports', 'recipes', 'comments']

// pannello del moderatore: segnalazioni, ricette e commenti (il backend autorizza admin e moderatori).
// Le azioni riservate agli admin (eliminazione definitiva, modifica e riattivazione di ricette altrui)
// sono nascoste dentro i singoli componenti in base al ruolo.
function Moderation() {
	const { t } = useTranslation()
	const [tab, setTab] = useState<Tab>('reports')

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('moderation.title')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('moderation.subtitle')}</p>

			<div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--wc-border)] pb-3" role="tablist">
				{TABS.map((x) => (
					<button
						key={x}
						role="tab"
						aria-selected={tab === x}
						onClick={() => setTab(x)}
						className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
							tab === x
								? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]'
								: 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'
						}`}
					>
						{t(`admin.tabs.${x}`)}
					</button>
				))}
			</div>

			<div className="mt-6">
				{tab === 'reports' && <AdminReports />}
				{tab === 'recipes' && <AdminRecipes />}
				{tab === 'comments' && <AdminComments />}
			</div>
		</div>
	)
}

export default Moderation
