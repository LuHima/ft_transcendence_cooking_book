import { Routes, Route } from 'react-router-dom'
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
import MealPlan from './pages/MealPlan'
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

function App() {
	return (
		<ToastProvider>
		<AuthProvider>
			<Routes>
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
						<Route path="meal-plan" element={<MealPlan />} />
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
		</AuthProvider>
		</ToastProvider>
	)
}

export default App
