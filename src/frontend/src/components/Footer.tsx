import { Link } from 'react-router-dom'

function Footer() {
	return (
		<footer className="mt-16 border-t border-[var(--wc-border)] bg-[var(--wc-surface)]">
			<div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-[var(--wc-text-muted)] sm:flex-row">
				<p>© {new Date().getFullYear()} WeCook</p>
				<nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Informazioni">
					<Link to="/contacts" className="hover:text-[var(--wc-saffron)]">
						Contatti
					</Link>
					<Link to="/about" className="hover:text-[var(--wc-saffron)]">
						Chi siamo
					</Link>
					<Link to="/privacy" className="hover:text-[var(--wc-saffron)]">
						Privacy e diritti
					</Link>
				</nav>
			</div>
		</footer>
	)
}

export default Footer
