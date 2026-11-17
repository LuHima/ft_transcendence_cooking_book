import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AdminReports from './AdminReports'
import AdminUsers from './AdminUsers'
import AdminRecipes from './AdminRecipes'
import AdminComments from './AdminComments'
import AdminCatalog from './AdminCatalog'

type Tab = 'reports' | 'users' | 'recipes' | 'comments' | 'catalog'

const TABS: Tab[] = ['reports', 'users', 'recipes', 'comments', 'catalog']
const isTab = (v: string | null): v is Tab => (TABS as string[]).includes(v ?? '')

// pannello admin: tutto ciò che vede il moderatore (segnalazioni) + gestione utenti, ruoli, ricette e commenti
function Admin() {
	const { t } = useTranslation()
	// active tab in the URL (?tab=…): reloads keep it and other panels can deep-link here,
	// e.g. ?tab=reports&subject=comment&target_id=42 (filters read by AdminReports)
	const [params, setParams] = useSearchParams()
	const tab: Tab = isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'reports'

	// switching tab drops the other panel's filters
	function setTab(next: Tab) {
		if (next !== tab) setParams({ tab: next })
	}

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('nav.adminPanel')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('admin.subtitle')}</p>

			<div className="mt-6 tab-row flex sm:flex-wrap gap-2 border-b border-[var(--wc-border)] pb-3" role="tablist">
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
				{tab === 'catalog' && <AdminCatalog />}
			</div>
		</div>
	)
}

export default Admin
