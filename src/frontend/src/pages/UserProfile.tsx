import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api, ApiError, asArray } from '../api/client'
import Avatar from '../components/Avatar'
import RecipeCard from '../components/RecipeCard'
import type { PublicUser, Recipe } from '../types/models'

// profilo pubblico di un altro utente: solo username, avatar, ricette pubblicate e tasto segui.
// NB: endpoint da esporre lato backend:
//   GET    /users/:id          -> PublicUser (senza email/anagrafica)
//   GET    /users/:id/recipes  -> Recipe[]
//   POST   /users/:id/follow   /  DELETE /users/:id/follow
// wrapper: key={id} rimonta il componente al cambio utente, così lo stato riparte pulito
function UserProfile() {
	const { id } = useParams()
	return <UserProfileView key={id} id={id} />
}

function UserProfileView({ id }: { id?: string }) {
	const { user: me } = useAuth()
	const navigate = useNavigate()
	const [profile, setProfile] = useState<PublicUser | null>(null)
	const [recipes, setRecipes] = useState<Recipe[]>([])
	const [error, setError] = useState<string | null>(null)
	const [followError, setFollowError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	useEffect(() => {
		let cancelled = false
		Promise.all([api.get<PublicUser>(`/users/${id}`), api.get<Recipe[]>(`/users/${id}/recipes`)])
			.then(([p, r]) => {
				if (cancelled) return
				// risposta vuota o non valida = endpoint assente / utente inesistente
				if (!p || typeof p.id !== 'number') throw new ApiError(404, 'Utente non trovato.')
				setProfile(p)
				setRecipes(asArray<Recipe>(r))
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof ApiError ? err.message : 'Utente non trovato.')
			})
		return () => {
			cancelled = true
		}
	}, [id])

	async function toggleFollow() {
		if (!profile) return
		if (!me) return navigate('/login')
		setBusy(true)
		setFollowError(null)
		try {
			if (profile.is_following) {
				await api.delete(`/users/${profile.id}/follow`)
				setProfile({
					...profile,
					is_following: false,
					followers_count: Math.max(0, (profile.followers_count ?? 1) - 1),
				})
			} else {
				await api.post(`/users/${profile.id}/follow`)
				setProfile({ ...profile, is_following: true, followers_count: (profile.followers_count ?? 0) + 1 })
			}
		} catch (err) {
			setFollowError(err instanceof ApiError ? err.message : 'Operazione non riuscita.')
		} finally {
			setBusy(false)
		}
	}

	if (error) return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-paprika)]">{error}</p>
	if (!profile) return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-text-muted)]">Caricamento…</p>

	const isMe = me?.id === profile.id
	const isFriend = profile.is_following && profile.follows_me

	return (
		<div className="mx-auto max-w-5xl px-4 py-12">
			<div className="flex flex-wrap items-center gap-5">
				<Avatar username={profile.username} url={profile.avatar_url} className="h-20 w-20 text-3xl" />
				<div className="min-w-0 flex-1">
					<h1 className="font-display text-3xl text-[var(--wc-text)]">{profile.username}</h1>
					<p className="mt-1 text-sm text-[var(--wc-text-muted)]">
						{recipes.length} {recipes.length === 1 ? 'ricetta' : 'ricette'}
						{profile.followers_count != null && ` · ${profile.followers_count} follower`}
						{isFriend && <span className="ml-2 rounded-full bg-[var(--wc-basil)] px-2 py-0.5 text-xs text-[var(--wc-bg)]">Amici</span>}
					</p>
				</div>
				{!isMe && (
					<button
						onClick={toggleFollow}
						disabled={busy}
						className={`rounded-full px-5 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
							profile.is_following
								? 'border border-[var(--wc-border)] text-[var(--wc-text)] hover:border-[var(--wc-paprika)] hover:text-[var(--wc-paprika)]'
								: 'bg-[var(--wc-basil)] text-[var(--wc-bg)] hover:bg-[var(--wc-basil-dark)]'
						}`}
					>
						{profile.is_following ? 'Smetti di seguire' : profile.follows_me ? 'Segui anche tu' : 'Segui'}
					</button>
				)}
			</div>
			{followError && <p className="mt-3 text-sm text-[var(--wc-paprika)]">{followError}</p>}

			<h2 className="mt-10 font-display text-xl text-[var(--wc-saffron)]">Ricette pubblicate</h2>
			{recipes.length === 0 ? (
				<p className="mt-4 text-[var(--wc-text-muted)]">Questo utente non ha ancora pubblicato ricette.</p>
			) : (
				<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{recipes.map((r) => (
						<RecipeCard key={r.id} recipe={{ ...r, user: r.user ?? { id: profile.id, username: profile.username } }} />
					))}
				</div>
			)}
		</div>
	)
}

export default UserProfile
