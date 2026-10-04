import { useState } from 'react'
import AdminUsers from './AdminUsers'
import AdminRecipes from './AdminRecipes'
import AdminComments from './AdminComments'

type Tab = 'users' | 'recipes' | 'comments'

const TABS: { value: Tab; label: string }[] = [
	{ value: 'users', label: 'Utenti' },
	{ value: 'recipes', label: 'Ricette' },
	{ value: 'comments', label: 'Commenti' },
]

// pannello admin: gestione utenti (CRUD, ruoli, ban) e moderazione di ricette e commenti
function Admin() {
	const [tab, setTab] = useState<Tab>('users')

	return (
		<div className="mx-auto max-w-6xl px-4 py-12">
			<h1 className="font-display text-3xl text-[var(--wc-saffron)]">Pannello admin</h1>
			<p className="mt-1 text-sm text-[var(--wc-text-muted)]">Gestione utenti e moderazione dei contenuti.</p>

			<div className="mt-6 flex gap-2 border-b border-[var(--wc-border)] pb-3" role="tablist">
				{TABS.map((t) => (
					<button
						key={t.value}
						role="tab"
						aria-selected={tab === t.value}
						onClick={() => setTab(t.value)}
						className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
							tab === t.value
								? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]'
								: 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'
						}`}
					>
						{t.label}
					</button>
				))}
			</div>

			<div className="mt-6">
				{tab === 'users' && <AdminUsers />}
				{tab === 'recipes' && <AdminRecipes />}
				{tab === 'comments' && <AdminComments />}
			</div>
		</div>
	)
}

export default Admin
