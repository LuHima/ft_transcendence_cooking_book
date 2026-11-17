import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation, useNavigate, type Location } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useDialogDismiss } from './lib/useDialogDismiss'

const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Profile = lazy(() => import('./pages/Profile'))
const Anagrafica = lazy(() => import('./pages/Anagrafica'))
const Favorites = lazy(() => import('./pages/Favorites'))
const MyRecipes = lazy(() => import('./pages/MyRecipes'))
const RecipeForm = lazy(() => import('./pages/RecipeForm'))
const RecipeDetail = lazy(() => import('./pages/RecipeDetail'))
const SearchResults = lazy(() => import('./pages/SearchResults'))
const Contacts = lazy(() => import('./pages/Contacts'))
const About = lazy(() => import('./pages/About'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const UserProfile = lazy(() => import('./pages/UserProfile'))
const Friends = lazy(() => import('./pages/Friends'))
const Admin = lazy(() => import('./pages/admin/Admin'))
const Moderation = lazy(() => import('./pages/Moderation'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RecipeDetailOverlay() {
	const { t } = useTranslation()
	const navigate = useNavigate()
	// Escape anywhere goes back to the kitchen (unless an inner dialog is open: it closes first)
	useDialogDismiss(() => navigate(-1))

	return (
		<div
			className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--wc-bg)]"
			role="dialog"
			aria-modal="true"
			aria-label={t('recipe.detailDialog')}
		>
			<div className="sticky top-0 z-10 border-b border-[var(--wc-border)] bg-[var(--wc-bg)]/95 px-4 py-3 backdrop-blur">
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="text-sm text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]"
				>
					← {t('recipe.backToKitchen')}
				</button>
			</div>
			<Suspense fallback={null}>
				<RecipeDetail />
			</Suspense>
		</div>
	)
}

function App() {
	const location = useLocation()
	const backgroundLocation = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation
	return (
		<ToastProvider>
		<AuthProvider>
			<Routes location={backgroundLocation ?? location}>
				<Route element={<Layout />}>
					<Route index element={null} />
					<Route path="login" element={<Login />} />
					<Route path="register" element={<Register />} />
					<Route path="search" element={<SearchResults />} />
					<Route path="recipes/:id" element={<RecipeDetail />} />
					<Route path="users/:id" element={<UserProfile />} />
					<Route path="u/:username" element={<UserProfile />} />
					<Route path="contacts" element={<Contacts />} />
					<Route path="about" element={<About />} />
					<Route path="privacy" element={<Privacy />} />
					<Route path="terms" element={<Terms />} />

					<Route element={<ProtectedRoute />}>
						<Route path="profile" element={<Profile />} />
						<Route path="anagrafica" element={<Anagrafica />} />
						<Route path="favorites" element={<Favorites />} />
						<Route path="my-recipes" element={<MyRecipes />} />
						<Route path="my-recipes/new" element={<RecipeForm />} />
						<Route path="my-recipes/:id/edit" element={<RecipeForm />} />
						<Route path="friends" element={<Friends />} />
					</Route>

					<Route element={<ProtectedRoute roles={['moderator', 'admin']} />}>
						<Route path="moderation" element={<Moderation />} />
					</Route>

					<Route element={<ProtectedRoute roles={['admin']} />}>
						<Route path="admin" element={<Admin />} />
					</Route>

					<Route path="*" element={<NotFound />} />
				</Route>
			</Routes>
			{backgroundLocation && (
				<Routes>
					<Route path="recipes/:id" element={<RecipeDetailOverlay />} />
				</Routes>
			)}
		</AuthProvider>
		</ToastProvider>
	)
}

export default App
