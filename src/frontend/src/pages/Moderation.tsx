import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AdminReports from './admin/AdminReports'
import AdminRecipes from './admin/AdminRecipes'
import AdminComments from './admin/AdminComments'

type Tab = 'reports' | 'recipes' | 'comments'
const TABS: Tab[] = ['reports', 'recipes', 'comments']
const isTab = (v: string | null): v is Tab => (TABS as string[]).includes(v ?? '')

// Moderator panel: reports, recipes and comments (the backend allows both admins and moderators).
// Admin-only actions (permanent deletion, editing recipes, and reactivating admin-authored recipes) are enforced by role.
function Moderation() {
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
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">{t('moderation.title')}</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">{t('moderation.subtitle')}</p>

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
				{tab === 'recipes' && <AdminRecipes />}
				{tab === 'comments' && <AdminComments />}
			</div>
		</div>
	)
}

export default Moderation
