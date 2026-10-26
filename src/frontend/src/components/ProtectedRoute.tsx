import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types/models'

interface ProtectedRouteProps {
	// se presente, l'utente deve avere uno di questi ruoli (es. ['admin'])
	roles?: UserRole[]
}

function ProtectedRoute({ roles }: ProtectedRouteProps) {
	const { t } = useTranslation()
	const { user, isLoading } = useAuth()
	const location = useLocation()

	if (isLoading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center text-[var(--wc-text-muted)]">
				{t('common.loading')}
			</div>
		)
	}

	if (!user) {
		return <Navigate to="/login" replace state={{ from: location }} />
	}

	if (roles && !roles.includes(user.role)) {
		return (
			<div className="mx-auto max-w-xl px-4 py-24 text-center">
				<h1 className="font-display text-3xl text-[var(--wc-paprika)]">{t('common.accessDenied')}</h1>
				<p className="mt-3 text-[var(--wc-text-muted)]">{t('common.noPermission')}</p>
			</div>
		)
	}

	return <Outlet />
}

export default ProtectedRoute
