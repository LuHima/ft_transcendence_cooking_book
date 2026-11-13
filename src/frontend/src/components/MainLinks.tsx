import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const linkBase = 'px-3 py-2 text-sm rounded-full transition-colors whitespace-nowrap'
const linkClass = ({ isActive }: { isActive: boolean }) =>
	`${linkBase} ${isActive ? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'}`

// Fixed top-bar links, the same for every role; personal links live in the user menu
function MainLinks() {
	const { t } = useTranslation()
	return (
		<>
			<NavLink to="/contacts" className={linkClass}>
				{t('nav.contacts')}
			</NavLink>
			<NavLink to="/about" className={linkClass}>
				{t('nav.about')}
			</NavLink>
		</>
	)
}

export default MainLinks
