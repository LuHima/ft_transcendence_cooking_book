import { Routes, Route, useLocation, useNavigate, type Location } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Anagrafica from './pages/Anagrafica'
import Favorites from './pages/Favorites'
import MyRecipes from './pages/MyRecipes'
import RecipeForm from './pages/RecipeForm'
import RecipeDetail from './pages/RecipeDetail'
import SearchResults from './pages/SearchResults'
import Contacts from './pages/Contacts'
import About from './pages/About'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import UserProfile from './pages/UserProfile'
import Friends from './pages/Friends'
import Admin from './pages/admin/Admin'
import Moderation from './pages/Moderation'
import NotFound from './pages/NotFound'

function RecipeDetailOverlay() {
	const navigate = useNavigate()

	return (
		<div
			className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--wc-bg)]"
			role="dialog"
			aria-modal="true"
			aria-label="Recipe detail"
		>
			<div className="sticky top-0 z-10 border-b border-[var(--wc-border)] bg-[var(--wc-bg)]/95 px-4 py-3 backdrop-blur">
				<button
					type="button"
					onClick={() => navigate(-1)}
					className="text-sm text-[var(--wc-text-muted)] hover:text-[var(--wc-text)]"
				>
					← Torna alla cucina
				</button>
			</div>
			<RecipeDetail />
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
					<Route index element={<Home />} />
					<Route path="login" element={<Login />} />
					<Route path="register" element={<Register />} />
					<Route path="search" element={<SearchResults />} />
					<Route path="recipes/:id" element={<RecipeDetail />} />
					<Route path="users/:id" element={<UserProfile />} />
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
