import { lazy, Suspense, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import ErrorBoundary from './ErrorBoundary'

const Home = lazy(() => import('../pages/Home'))

function Layout() {
	const location = useLocation()
	const isHome = location.pathname === '/'
	const [hasVisitedHome, setHasVisitedHome] = useState(isHome)

	if (isHome && !hasVisitedHome) {
		setHasVisitedHome(true)
	}

	return (
		<div className="flex min-h-screen flex-col bg-[var(--wc-bg)] text-[var(--wc-text)]">
			<Navbar />
			<main className="flex-1">
				{(hasVisitedHome || isHome) && (
					<div className={isHome ? '' : 'hidden'} aria-hidden={!isHome}>
						<ErrorBoundary key="persistent-home">
							<Suspense fallback={null}>
								<Home active={isHome} />
							</Suspense>
						</ErrorBoundary>
					</div>
				)}
				{!isHome && (
					<ErrorBoundary key={location.pathname}>
						<Suspense fallback={null}>
							<Outlet />
						</Suspense>
					</ErrorBoundary>
				)}
			</main>
			<Footer />
		</div>
	)
}

export default Layout
