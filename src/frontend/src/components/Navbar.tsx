import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SearchBar from './SearchBar'
import logo from '../assets/logo.png'

const linkBase = 'px-3 py-2 text-sm rounded-full transition-colors whitespace-nowrap'
const linkClass = ({ isActive }: { isActive: boolean }) =>
	`${linkBase} ${isActive ? 'bg-[var(--wc-surface-raised)] text-[var(--wc-saffron)]' : 'text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]'}`

function Navbar() {
	const { user, signOut } = useAuth()
	const navigate = useNavigate()
	const [menuOpen, setMenuOpen] = useState(false)

	async function handleSignOut() {
		await signOut()
		setMenuOpen(false)
		navigate('/')
	}

	return (
		<header className="sticky top-0 z-50 border-b border-[var(--wc-border)] bg-[var(--wc-bg)]/95 backdrop-blur">
			<div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
				<Link to="/" className="flex items-center gap-2 shrink-0">
					<img src={logo} alt="" className="h-8 w-8" />
					<span className="font-display text-xl text-[var(--wc-text)]">WeCook</span>
				</Link>

				<nav className="hidden lg:flex items-center gap-1">
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
						</>
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
				</nav>

				<SearchBar className="ml-auto hidden md:flex max-w-xs" />

				<div className="relative shrink-0">
					{user ? (
						<button
							onClick={() => setMenuOpen((v) => !v)}
							className="flex items-center gap-2 rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-sm text-[var(--wc-text)] hover:border-[var(--wc-basil)]"
						>
							{user.avatar_url ? (
								<img src={user.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
							) : (
								<span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--wc-basil)] text-xs font-semibold text-[var(--wc-bg)]">
									{user.username.charAt(0).toUpperCase()}
								</span>
							)}
							{user.username}
						</button>
					) : (
						<div className="flex items-center gap-2">
							<Link
								to="/login"
								className="rounded-full px-3 py-1.5 text-sm text-[var(--wc-text)] hover:text-[var(--wc-saffron)]"
							>
								Accedi
							</Link>
							<Link
								to="/register"
								className="rounded-full bg-[var(--wc-basil)] px-3 py-1.5 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
							>
								Registrati
							</Link>
						</div>
					)}

					{user && menuOpen && (
						<div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] shadow-lg">
							<Link
								to="/profile"
								onClick={() => setMenuOpen(false)}
								className="block px-4 py-2 text-sm text-[var(--wc-text)] hover:bg-[var(--wc-surface-raised)]"
							>
								Profilo
							</Link>
							<Link
								to="/anagrafica"
								onClick={() => setMenuOpen(false)}
								className="block px-4 py-2 text-sm text-[var(--wc-text)] hover:bg-[var(--wc-surface-raised)]"
							>
								Anagrafica
							</Link>
							<button
								onClick={handleSignOut}
								className="block w-full px-4 py-2 text-left text-sm text-[var(--wc-paprika)] hover:bg-[var(--wc-surface-raised)]"
							>
								Esci
							</button>
						</div>
					)}
				</div>
			</div>

			{/* barra di ricerca + link principali su mobile */}
			<div className="flex flex-col gap-2 border-t border-[var(--wc-border)] px-4 py-2 md:hidden">
				<SearchBar />
				<nav className="flex flex-wrap gap-1">
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
						</>
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
				</nav>
			</div>
		</header>
	)
}

export default Navbar
