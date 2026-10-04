import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import ErrorBoundary from './ErrorBoundary'

function Layout() {
	const location = useLocation()
	return (
		<div className="flex min-h-screen flex-col bg-[var(--wc-bg)] text-[var(--wc-text)]">
			<Navbar />
			<main className="flex-1">
				{/* key sul percorso: dopo un errore, cambiando pagina il boundary si resetta */}
				<ErrorBoundary key={location.pathname}>
					<Outlet />
				</ErrorBoundary>
			</main>
			<Footer />
		</div>
	)
}

export default Layout
