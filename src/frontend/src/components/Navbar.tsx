import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import SearchBar from './SearchBar'
import NotificationBell from './NotificationBell'
import MainLinks from './MainLinks'
import LanguageSwitcher from './LanguageSwitcher'
import Avatar from './Avatar'
import logo from '../assets/logo.png'

const itemClass = 'block px-4 py-2 text-sm text-[var(--wc-text)] hover:bg-[var(--wc-surface-raised)]'

// barra in alto, uguale per tutti: logo, Contatti, Chi siamo, ricerca, lingua;
// se loggato anche campanella e menù utente, altrimenti Accedi / Registrati.
// Il menù a tendina dell'utente contiene: [pannello moderatore | pannello amministratore], Profilo,
// Le mie ricette, Preferiti, Meal plan, Amici, Anagrafica, Esci.
function Navbar() {
	const { t } = useTranslation()
	const { user, signOut } = useAuth()
	const navigate = useNavigate()
	const [menuOpen, setMenuOpen] = useState(false)
	const menuRef = useRef<HTMLDivElement>(null)

	// chiude il menù cliccando fuori o con Esc
	useEffect(() => {
		if (!menuOpen) return
		function onDown(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') setMenuOpen(false)
		}
		document.addEventListener('mousedown', onDown)
		document.addEventListener('keydown', onKey)
		return () => {
			document.removeEventListener('mousedown', onDown)
			document.removeEventListener('keydown', onKey)
		}
	}, [menuOpen])

	async function handleSignOut() {
		await signOut()
		setMenuOpen(false)
		navigate('/')
	}

	const close = () => setMenuOpen(false)

	return (
		<header className="sticky top-0 z-50 border-b border-[var(--wc-border)] bg-[var(--wc-bg)]/95 backdrop-blur">
			<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
				<Link to="/" className="flex shrink-0 items-center gap-2">
					<img src={logo} alt="" className="h-8 w-8" />
					<span className="font-display text-xl text-[var(--wc-text)]">WeCook</span>
				</Link>

				<nav className="flex items-center gap-1">
					<MainLinks />
				</nav>

				<SearchBar className="ml-auto hidden max-w-xs md:flex" />

				<div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
					<LanguageSwitcher />
					{user && <NotificationBell />}
					<div ref={menuRef} className="relative shrink-0">
						{user ? (
							<button
								onClick={() => setMenuOpen((v) => !v)}
								aria-haspopup="menu"
								aria-expanded={menuOpen}
								className="flex items-center gap-2 rounded-full border border-[var(--wc-border)] px-3 py-1.5 text-sm text-[var(--wc-text)] hover:border-[var(--wc-basil)]"
							>
								<Avatar username={user.username} url={user.avatar_url} className="h-6 w-6 text-xs" />
								<span className="max-w-[8rem] truncate">{user.username}</span>
								{user.role !== 'user' && (
									<span className="rounded-full bg-[var(--wc-saffron)] px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--wc-bg)]">
										{t(`role.${user.role}`)}
									</span>
								)}
								<span aria-hidden="true" className="text-xs text-[var(--wc-text-muted)]">▾</span>
							</button>
						) : (
							<div className="flex items-center gap-2">
								<Link to="/login" className="rounded-full px-3 py-1.5 text-sm text-[var(--wc-text)] hover:text-[var(--wc-saffron)]">
									{t('nav.signIn')}
								</Link>
								<Link
									to="/register"
									className="rounded-full bg-[var(--wc-basil)] px-3 py-1.5 text-sm font-medium text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]"
								>
									{t('nav.signUp')}
								</Link>
							</div>
						)}

						{user && menuOpen && (
							<div
								role="menu"
								className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--wc-surface)] py-1 shadow-lg"
							>
								{user.role === 'moderator' && (
									<Link
										to="/moderation"
										role="menuitem"
										onClick={close}
										className={`${itemClass} border-b border-[var(--wc-border)] font-medium text-[var(--wc-saffron)]`}
									>
										{t('nav.moderatorPanel')}
									</Link>
								)}
								{user.role === 'admin' && (
									<Link
										to="/admin"
										role="menuitem"
										onClick={close}
										className={`${itemClass} border-b border-[var(--wc-border)] font-medium text-[var(--wc-saffron)]`}
									>
										{t('nav.adminPanel')}
									</Link>
								)}
								<Link to="/profile" role="menuitem" onClick={close} className={itemClass}>
									{t('nav.profile')}
								</Link>
								<Link to="/my-recipes" role="menuitem" onClick={close} className={itemClass}>
									{t('nav.myRecipes')}
								</Link>
								<Link to="/favorites" role="menuitem" onClick={close} className={itemClass}>
									{t('nav.favorites')}
								</Link>
								<Link to="/friends" role="menuitem" onClick={close} className={itemClass}>
									{t('nav.friends')}
								</Link>
								<Link to="/anagrafica" role="menuitem" onClick={close} className={itemClass}>
									{t('nav.personalData')}
								</Link>
								<button
									role="menuitem"
									onClick={handleSignOut}
									className="block w-full border-t border-[var(--wc-border)] px-4 py-2 text-left text-sm text-[var(--wc-paprika)] hover:bg-[var(--wc-surface-raised)]"
								>
									{t('nav.signOut')}
								</button>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* su mobile la ricerca passa su una riga propria */}
			<div className="border-t border-[var(--wc-border)] px-4 py-2 md:hidden">
				<SearchBar />
			</div>
		</header>
	)
}

export default Navbar
