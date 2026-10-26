import { useTranslation } from 'react-i18next'

function About() {
	const { t } = useTranslation()
	return (
		<div className="mx-auto max-w-2xl px-4 py-16">
			<h1 className="font-display text-4xl text-[var(--wc-saffron)]">{t('about.title')}</h1>
			<p className="mt-4 text-[var(--wc-text-muted)]">{t('about.p1')}</p>
			<p className="mt-4 text-[var(--wc-text-muted)]">{t('about.p2')}</p>
		</div>
	)
}

export default About
