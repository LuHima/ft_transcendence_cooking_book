import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SearchBar from './SearchBar'
import NotificationBell from './NotificationBell'
import MainLinks from './MainLinks'
import Avatar from './Avatar'
import logo from '../assets/logo.png'

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

				<nav className="hidden xl:flex items-center gap-1">
					<MainLinks />
				</nav>

				<SearchBar className="ml-auto hidden md:flex max-w-xs" />

				<div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
					{user && <NotificationBell />}
					<div className="relative shrink-0">
						{user ? (
							<button
								onClick={() => setMenuOpen((v) => !v)}
								className="flex items-center gap-2 rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-sm text-[var(--wc-text)] hover:border-[var(--wc-basil)]"
							>
								<Avatar username={user.username} url={user.avatar_url} className="h-6 w-6 text-xs" />
								{user.username}
								{user.role === 'admin' && (
									<span className="rounded-full bg-[var(--wc-saffron)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--wc-bg)]">
										admin
									</span>
								)}
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
								{user.role === 'admin' && (
									<Link
										to="/admin"
										onClick={() => setMenuOpen(false)}
										className="block px-4 py-2 text-sm font-medium text-[var(--wc-saffron)] hover:bg-[var(--wc-surface-raised)]"
									>
										Pannello admin
									</Link>
								)}
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
			</div>

			{/* barra di ricerca + link principali su mobile */}
			<div className="flex flex-col gap-2 border-t border-[var(--wc-border)] px-4 py-2 xl:hidden">
				<SearchBar className="md:hidden" />
				<nav className="flex flex-wrap gap-1">
					<MainLinks />
				</nav>
			</div>
		</header>
	)
}

export default Navbar
