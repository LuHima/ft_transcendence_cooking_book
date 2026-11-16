import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import ErrorBoundary from './ErrorBoundary'
import Home from '../pages/Home'

function Layout() {
	const location = useLocation()
	const isHome = location.pathname === '/'
	const [hasVisitedHome, setHasVisitedHome] = useState(isHome)

	useEffect(() => {
		if (isHome) setHasVisitedHome(true)
	}, [isHome])

	return (
		<div className="flex min-h-screen flex-col bg-[var(--wc-bg)] text-[var(--wc-text)]">
			<Navbar />
			<main className="flex-1">
				{(hasVisitedHome || isHome) && (
					<div className={isHome ? '' : 'hidden'} aria-hidden={!isHome}>
						<ErrorBoundary key="persistent-home">
							<Home active={isHome} />
						</ErrorBoundary>
					</div>
				)}
				{!isHome && (
					<ErrorBoundary key={location.pathname}>
						<Outlet />
					</ErrorBoundary>
				)}
			</main>
			<Footer />
		</div>
	)
}

export default Layout
