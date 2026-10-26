import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { api, ApiError, getErrorMessage, qs } from '../api/client'
import { useLang } from '../lib/useLang'
import Avatar from '../components/Avatar'
import FriendButton from '../components/FriendButton'
import Pagination from '../components/Pagination'
import RecipeCard from '../components/RecipeCard'
import { ReportButton } from '../components/ReportDialog'
import { RecipeGridSkeleton, Skeleton } from '../components/Skeleton'
import type { Friendship, Paginated, PublicUser, RecipeSummary } from '../types/models'

const PAGE_SIZE = 9

// profilo pubblico di un altro utente: solo username, avatar, ricette pubblicate e tasto amicizia.
// GET /users/:id (già pronta) + GET /recipes?author_id=:id (già pronta).
// NB: per l'amicizia GET /users/:id deve includere `friendship: { status, direction?, request_id? }`
// (calcolata rispetto all'utente loggato), più `recipes_count` e `friends_count`.
// wrapper: key={id} rimonta il componente al cambio utente, così lo stato riparte pulito
function UserProfile() {
	const { id } = useParams()
	return <UserProfileView key={id} id={id} />
}

function UserProfileView({ id }: { id?: string }) {
	const { t } = useTranslation()
	const lang = useLang()
	const { user: me } = useAuth()
	const [profile, setProfile] = useState<PublicUser | null>(null)
	const [recipes, setRecipes] = useState<Paginated<RecipeSummary> | null>(null)
	const [page, setPage] = useState(1)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		api
			.get<PublicUser>(`/users/${id}`)
			.then((p) => {
				if (cancelled) return
				// risposta vuota o non valida = utente inesistente
				if (!p || typeof p.id !== 'number') throw new ApiError(404, t('profile.notFound'))
				setProfile(p)
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof ApiError && err.status !== 404 ? err.message : t('profile.notFound'))
			})
		return () => {
			cancelled = true
		}
	}, [id, t])

	useEffect(() => {
		let cancelled = false
		api
			.get<Paginated<RecipeSummary>>(`/recipes${qs({ author_id: id, page, limit: PAGE_SIZE, lang })}`)
			.then((r) => {
				if (!cancelled) setRecipes(r)
			})
			.catch((err) => {
				if (!cancelled) {
					setRecipes(null)
					setError((prev) => prev ?? getErrorMessage(err, t('myRecipes.loadError')))
				}
			})
		return () => {
			cancelled = true
		}
	}, [id, page, lang, t])

	function updateFriendship(next: Friendship) {
		setProfile((prev) => {
			if (!prev) return prev
			const wasFriend = prev.friendship?.status === 'accepted'
			const isFriend = next.status === 'accepted'
			const delta = isFriend === wasFriend ? 0 : isFriend ? 1 : -1
			return {
				...prev,
				friendship: next,
				friends_count: prev.friends_count != null ? Math.max(0, prev.friends_count + delta) : prev.friends_count,
			}
		})
	}

	if (error && !profile) return <p className="mx-auto max-w-2xl px-4 py-16 text-[var(--wc-paprika)]">{error}</p>
	if (!profile) {
		return (
			<div role="status" aria-busy="true" className="mx-auto max-w-5xl px-4 py-12">
				<div className="flex items-center gap-5">
					<Skeleton className="h-20 w-20 rounded-full" />
					<Skeleton className="h-8 w-48" />
				</div>
				<div className="mt-10">
					<RecipeGridSkeleton count={3} />
				</div>
			</div>
		)
	}

	const isMe = me?.id === profile.id
	const recipeCount = profile.recipes_count ?? recipes?.total

	return (
		<div className="mx-auto max-w-5xl px-4 py-12">
			<div className="flex flex-wrap items-center gap-5">
				<Avatar username={profile.username} url={profile.avatar_url} className="h-20 w-20 text-3xl" />
				<div className="min-w-0 flex-1">
					<h1 className="truncate font-display text-3xl text-[var(--wc-text)]">{profile.username}</h1>
					<p className="mt-1 text-sm text-[var(--wc-text-muted)]">
						{recipeCount != null && t('profile.recipesCount', { count: recipeCount })}
						{profile.friends_count != null && ` · ${t('profile.friendsCount', { count: profile.friends_count })}`}
					</p>
				</div>
				{isMe ? (
					<Link
						to="/profile"
						className="rounded-full border border-[var(--wc-border)] px-5 py-2 text-sm hover:border-[var(--wc-basil)]"
					>
						{t('profile.editMine')}
					</Link>
				) : (
					<FriendButton
						userId={profile.id}
						username={profile.username}
						friendship={profile.friendship}
						onChange={updateFriendship}
					/>
				)}
			</div>
			{!isMe && (
				<div className="mt-2">
					<ReportButton targetType="user" targetId={profile.id} ownerId={profile.id} />
				</div>
			)}

			<h2 className="mt-10 font-display text-xl text-[var(--wc-saffron)]">{t('profile.publishedRecipes')}</h2>
			{!recipes ? (
				<div className="mt-4">
					<RecipeGridSkeleton count={3} />
				</div>
			) : recipes.items.length === 0 ? (
				<p className="mt-4 text-[var(--wc-text-muted)]">{t('profile.noRecipes')}</p>
			) : (
				<>
					<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{recipes.items.map((r) => (
							<RecipeCard key={r.id} recipe={r} />
						))}
					</div>
					<Pagination page={recipes.page} totalPages={recipes.total_pages} onChange={setPage} />
				</>
			)}
		</div>
	)
}

export default UserProfile
