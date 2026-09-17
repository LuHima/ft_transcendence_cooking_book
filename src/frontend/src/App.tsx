import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
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
import NotFound from './pages/NotFound'

function App() {
	return (
		<AuthProvider>
			<Routes>
				<Route element={<Layout />}>
					<Route index element={<Home />} />
					<Route path="login" element={<Login />} />
					<Route path="register" element={<Register />} />
					<Route path="search" element={<SearchResults />} />
					<Route path="recipes/:id" element={<RecipeDetail />} />
					<Route path="contacts" element={<Contacts />} />
					<Route path="about" element={<About />} />
					<Route path="privacy" element={<Privacy />} />

					<Route element={<ProtectedRoute />}>
						<Route path="profile" element={<Profile />} />
						<Route path="anagrafica" element={<Anagrafica />} />
						<Route path="favorites" element={<Favorites />} />
						<Route path="meal-plan" element={<MealPlan />} />
						<Route path="my-recipes" element={<MyRecipes />} />
						<Route path="my-recipes/new" element={<RecipeForm />} />
						<Route path="my-recipes/:id/edit" element={<RecipeForm />} />
					</Route>

					<Route path="*" element={<NotFound />} />
				</Route>
			</Routes>
		</AuthProvider>
	)
}

export default App
