import { useTranslation } from 'react-i18next'

function Contacts() {
	const { t } = useTranslation()
	return (
		<div className="mx-auto max-w-2xl px-4 py-16">
			<h1 className="font-display text-4xl text-[var(--wc-saffron)]">{t('contacts.title')}</h1>
			<p className="mt-4 text-[var(--wc-text-muted)]">{t('contacts.intro')}</p>

			<dl className="mt-8 space-y-4 rounded-2xl border border-[var(--wc-border)] bg-[var(--wc-surface)] p-6">
				<div>
					<dt className="text-xs uppercase tracking-wide text-[var(--wc-text-muted)]">Email</dt>
					<dd className="text-[var(--wc-text)]">wecook.support@gmail.com</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wide text-[var(--wc-text-muted)]">Community</dt>
					<dd className="text-[var(--wc-text)]">discord.gg/wecook</dd>
				</div>
				<div>
					<dt className="text-xs uppercase tracking-wide text-[var(--wc-text-muted)]">{t('contacts.office')}</dt>
					<dd className="text-[var(--wc-text)]">{t('contacts.officeValue')}</dd>
				</div>
			</dl>
		</div>
	)
}

export default Contacts
