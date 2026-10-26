import { useTranslation } from 'react-i18next'

interface Section {
	title: string
	body: string
}

// Termini di servizio: testo in locales/*.json (chiave "terms.sections")
function Terms() {
	const { t } = useTranslation()
	const sections = t('terms.sections', { returnObjects: true }) as Section[]

	return (
		<div className="mx-auto max-w-2xl px-4 py-16">
			<h1 className="font-display text-4xl text-[var(--wc-saffron)]">{t('terms.title')}</h1>
			<p className="mt-2 text-sm text-[var(--wc-text-muted)]">{t('terms.updated')}</p>
			<p className="mt-4 text-[var(--wc-text-muted)]">{t('terms.intro')}</p>
			<div className="mt-6 space-y-6 text-[var(--wc-text-muted)]">
				{sections.map((s, i) => (
					<section key={s.title}>
						<h2 className="mb-1 text-lg font-semibold text-[var(--wc-text)]">
							{i + 1}. {s.title}
						</h2>
						<p>{s.body}</p>
					</section>
				))}
			</div>
		</div>
	)
}

export default Terms
