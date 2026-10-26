import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdminReports from './AdminReports'
import AdminUsers from './AdminUsers'
import AdminRecipes from './AdminRecipes'
import AdminComments from './AdminComments'

type Tab = 'reports' | 'users' | 'recipes' | 'comments'

const TABS: Tab[] = ['reports', 'users', 'recipes', 'comments']

// pannello admin: tutto ciò che vede il moderatore (segnalazioni) + gestione utenti, ruoli, ricette e commenti
function Admin() {
	const { t } = useTranslation()
	const [tab, setTab] = useState<Tab>('reports')

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('nav.adminPanel')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('admin.subtitle')}</p>

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
				{tab === 'users' && <AdminUsers />}
				{tab === 'recipes' && <AdminRecipes />}
				{tab === 'comments' && <AdminComments />}
			</div>
		</div>
	)
}

export default Admin
