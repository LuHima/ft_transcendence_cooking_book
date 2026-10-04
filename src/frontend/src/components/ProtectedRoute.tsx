import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types/models'

interface ProtectedRouteProps {
	// se presente, l'utente deve avere uno di questi ruoli (es. ['admin'])
	roles?: UserRole[]
}

function ProtectedRoute({ roles }: ProtectedRouteProps) {
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

	if (roles && !roles.includes(user.role)) {
		return (
			<div className="mx-auto max-w-xl px-4 py-24 text-center">
				<h1 className="font-display text-3xl text-[var(--wc-paprika)]">Accesso negato</h1>
				<p className="mt-3 text-[var(--wc-text-muted)]">Non hai i permessi per vedere questa pagina.</p>
			</div>
		)
	}

	return <Outlet />
}

export default ProtectedRoute
