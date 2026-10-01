import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute() {
	const { user, isLoading } = useAuth()
	const location = useLocation()

	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center text-[var(--wc-text-muted)]">
				Caricamento…
			</div>
		)
	}

	if (!user) {
		return <Navigate to="/login" replace state={{ from: location }} />
	}

	return <Outlet />
}

export default ProtectedRoute
