import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const linkBase = 'px-3 py-2 text-sm rounded-full transition-colors whitespace-nowrap'
const linkClass = ({ isActive }: { isActive: boolean }) =>
	`${linkBase} ${isActive ? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'}`

// link principali della navbar, differenziati per ruolo (ospite / user / admin)
function MainLinks() {
	const { user } = useAuth()
	const isAdmin = user?.role === 'admin'

	return (
		<>
			<NavLink to="/" end className={linkClass}>
				Home
			</NavLink>
			{user && (
				<>
					<NavLink to="/my-recipes" className={linkClass}>
						Le mie ricette
					</NavLink>
					<NavLink to="/favorites" className={linkClass}>
						Preferiti
					</NavLink>
					<NavLink to="/meal-plan" className={linkClass}>
						Meal plan
					</NavLink>
					<NavLink to="/friends" className={linkClass}>
						Amici
					</NavLink>
				</>
			)}
			{isAdmin && (
				<NavLink to="/admin" className={linkClass}>
					Pannello admin
				</NavLink>
			)}
			<NavLink to="/contacts" className={linkClass}>
				Contatti
			</NavLink>
			<NavLink to="/about" className={linkClass}>
				Chi siamo
			</NavLink>
			<NavLink to="/privacy" className={linkClass}>
				Privacy
			</NavLink>
		</>
	)
}

export default MainLinks
