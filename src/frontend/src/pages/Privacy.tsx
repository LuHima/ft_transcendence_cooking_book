import { useTranslation } from 'react-i18next'

interface Section {
	title: string
	body: string
}

function Privacy() {
	const { t } = useTranslation()
	const sections = t('privacy.sections', { returnObjects: true }) as Section[]

	return (
		<div className="mx-auto max-w-2xl px-4 py-16">
			<h1 className="font-display text-4xl text-[var(--wc-saffron)]">{t('privacy.title')}</h1>
			<div className="mt-6 space-y-6 text-[var(--wc-text-muted)]">
				{sections.map((s) => (
					<section key={s.title}>
						<h2 className="mb-1 text-lg font-semibold text-[var(--wc-text)]">{s.title}</h2>
						<p>{s.body}</p>
					</section>
				))}
			</div>
		</div>
	)
}

export default Privacy
