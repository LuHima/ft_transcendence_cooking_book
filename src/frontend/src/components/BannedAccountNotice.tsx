import { useTranslation } from 'react-i18next'
import { useLang } from '../lib/useLang'
import type { AccountBannedDetails } from '../types/models'

// card mostrata sopra il form di login quando l'account è sospeso (403 ACCOUNT_BANNED)
function BannedAccountNotice({ details }: { details: AccountBannedDetails }) {
	const { t } = useTranslation()
	const lang = useLang()
	const until = details.banned_until ? new Date(details.banned_until) : null
	const permanent = details.is_permanent || !until

	return (
		<div role="alert" className="mt-6 space-y-2 rounded-2xl border border-[var(--wc-paprika)] bg-[var(--wc-surface)] p-4 text-sm">
			<p className="font-display text-lg text-[var(--wc-paprika)]">
				{permanent ? t('auth.banned.titlePermanent') : t('auth.banned.title')}
			</p>
			<p className="text-[var(--wc-text)]">
				<span className="text-[var(--wc-text-muted)]">{t('auth.banned.reason')}: </span>
				{t(`report.reasons.${details.reason}`)}
			</p>
			{details.description && (
				<p className="whitespace-pre-line break-words text-[var(--wc-text)]">
					<span className="text-[var(--wc-text-muted)]">{t('auth.banned.explanation')}: </span>
					{details.description}
				</p>
			)}
			<p className="text-[var(--wc-text)]">
				{permanent
					? t('auth.banned.permanent')
					: t('auth.banned.until', {
							date: until!.toLocaleString(lang, { dateStyle: 'long', timeStyle: 'short' }),
						})}
			</p>
		</div>
	)
}

export default BannedAccountNotice
