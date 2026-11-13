import { useTranslation } from 'react-i18next'
import type { RecipePrivacy } from '../types/models'

const STYLE: Record<RecipePrivacy, string> = {
	public: 'border-[var(--wc-border)] text-[var(--wc-text-muted)]',
	friends_only: 'border-[var(--wc-saffron)] text-[var(--wc-saffron)]',
	private: 'border-[var(--wc-paprika)] text-[var(--wc-paprika)]',
}
const ICON: Record<RecipePrivacy, string> = { public: '🌐', friends_only: '👥', private: '🔒' }

interface PrivacyBadgeProps {
	privacy?: RecipePrivacy | null
	// false (default): nothing for public recipes; true: a badge for every level
	showPublic?: boolean
	className?: string
}

function PrivacyBadge({ privacy, showPublic = false, className = '' }: PrivacyBadgeProps) {
	const { t } = useTranslation()
	if (!privacy || (privacy === 'public' && !showPublic)) return null
	return (
		<span
			title={t(`privacy.${privacy}Help`)}
			className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLE[privacy]} ${className}`}
		>
			<span aria-hidden="true">{ICON[privacy]}</span>
			{t(`privacy.${privacy}`)}
		</span>
	)
}

export default PrivacyBadge
